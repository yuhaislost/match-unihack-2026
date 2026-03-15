import { NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import { completeBooking, processRefund } from "@/use-cases/complete-booking";
import { handleAccountUpdated } from "@/use-cases/stripe-connect";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  let event;
  try {
    event = constructWebhookEvent(body, signature);
  } catch (error) {
    console.error("[webhook.stripe] Signature verification failed", { error });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const result = await completeBooking(session.id);
        if (!result.success) {
          console.error("[webhook.stripe] completeBooking failed", {
            eventId: event.id,
            error: result.error,
          });
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        break;
      }

      case "account.updated": {
        const account = event.data.object;
        const result = await handleAccountUpdated(account.id);
        if (!result.success) {
          console.error("[webhook.stripe] handleAccountUpdated failed", {
            eventId: event.id,
            error: result.error,
          });
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        const bookingId = charge.metadata?.bookingId;
        if (bookingId) {
          const result = await processRefund(bookingId);
          if (!result.success) {
            console.error("[webhook.stripe] processRefund failed", {
              eventId: event.id,
              error: result.error,
            });
            return NextResponse.json({ error: result.error }, { status: 500 });
          }
        }
        break;
      }

      default:
        // Unhandled event type — acknowledge receipt
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[webhook.stripe] Unhandled error", {
      eventId: event.id,
      eventType: event.type,
      error,
    });
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}
