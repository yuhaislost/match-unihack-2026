import "server-only";

import { prisma } from "@/lib/prisma";
import {
  addUpsellsToPlayerShare,
  createMerchantPayoutRecord,
  getBookingBySessionId,
  markBookingPaid,
  processRefund as processBookingRefund,
} from "@/lib/services/booking";
import { makeSessionVisible } from "@/lib/services/session";
import {
  createCheckoutSession,
  createRefund,
  createTransfer,
  retrieveCheckoutSession,
} from "@/lib/stripe";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export async function initiateCheckout(
  playerId: string,
  sessionId: string,
  upsells?: Array<{ upsellItemId: string; quantity: number }>,
): Promise<ServiceResult<{ checkoutUrl: string }>> {
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { players: true },
    });
    if (!session || session.status !== "BOOKED") {
      return {
        success: false,
        error: "Session is not in BOOKED state",
        code: "BAD_REQUEST",
      };
    }

    const isPlayer = session.players.some((p) => p.playerId === playerId);
    if (!isPlayer) {
      return {
        success: false,
        error: "Player not in session",
        code: "FORBIDDEN",
      };
    }

    const booking = await getBookingBySessionId(sessionId);
    if (!booking) {
      return {
        success: false,
        error: "Booking not found",
        code: "NOT_FOUND",
      };
    }

    // Add upsells if any
    if (upsells && upsells.length > 0) {
      const upsellResult = await addUpsellsToPlayerShare({
        bookingId: booking.id,
        playerId,
        upsells,
      });
      if (!upsellResult.success) {
        return { success: false, error: upsellResult.error };
      }
    }

    // Re-fetch booking to get updated amounts
    const updatedBooking = await getBookingBySessionId(sessionId);
    if (!updatedBooking) {
      return { success: false, error: "Booking not found after update" };
    }

    const playerShare = updatedBooking.playerShares.find(
      (s) => s.playerId === playerId,
    );
    if (!playerShare) {
      return { success: false, error: "Player share not found" };
    }

    if (playerShare.status === "PAID") {
      return {
        success: false,
        error: "Already paid",
        code: "BAD_REQUEST",
      };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const lineItems = [
      {
        price_data: {
          currency: "aud",
          product_data: {
            name: `Court booking — ${updatedBooking.venue.name}`,
            description: `${updatedBooking.court.name} · Your share`,
          },
          unit_amount: Math.round(Number(playerShare.courtShareAmount) * 100),
        },
        quantity: 1,
      },
    ];

    // Add upsell line items
    for (const upsell of playerShare.upsells) {
      lineItems.push({
        price_data: {
          currency: "aud",
          product_data: {
            name: upsell.name,
            description: `Add-on`,
          },
          unit_amount: Math.round(Number(upsell.price) * 100),
        },
        quantity: upsell.quantity,
      });
    }

    const checkoutSession = await createCheckoutSession({
      lineItems,
      successUrl: `${baseUrl}/explore?booking=success&session=${sessionId}`,
      cancelUrl: `${baseUrl}/explore?booking=cancelled&session=${sessionId}`,
      metadata: {
        bookingId: booking.id,
        playerId,
        sessionId,
      },
    });

    // Store checkout session ID on booking
    await prisma.booking.update({
      where: { id: booking.id },
      data: { stripeCheckoutSessionId: checkoutSession.id },
    });

    if (!checkoutSession.url) {
      return { success: false, error: "Failed to create checkout URL" };
    }

    return { success: true, data: { checkoutUrl: checkoutSession.url } };
  } catch (error) {
    console.error("[complete-booking.initiateCheckout]", {
      playerId,
      sessionId,
      error,
    });
    return { success: false, error: "Failed to initiate checkout" };
  }
}

export async function completeBooking(
  stripeCheckoutSessionId: string,
): Promise<ServiceResult<null>> {
  try {
    const checkoutSession = await retrieveCheckoutSession(
      stripeCheckoutSessionId,
    );

    const bookingId = checkoutSession.metadata?.bookingId;
    const playerId = checkoutSession.metadata?.playerId;

    if (!bookingId || !playerId) {
      return {
        success: false,
        error: "Missing metadata in checkout session",
        code: "BAD_REQUEST",
      };
    }

    const paymentIntentId =
      typeof checkoutSession.payment_intent === "string"
        ? checkoutSession.payment_intent
        : (checkoutSession.payment_intent?.id ?? "");

    // Mark player's share as paid
    const paidResult = await markBookingPaid({
      bookingId,
      playerId,
      stripePaymentIntentId: paymentIntentId,
    });

    if (!paidResult.success) {
      return { success: false, error: paidResult.error };
    }

    // If all paid, create transfer to merchant
    if (paidResult.data.allPaid) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          venue: {
            include: {
              merchant: {
                select: {
                  id: true,
                  stripeConnectAccountId: true,
                  stripeChargesEnabled: true,
                },
              },
            },
          },
        },
      });

      if (
        booking?.venue.merchant.stripeConnectAccountId &&
        booking.venue.merchant.stripeChargesEnabled
      ) {
        const transferAmount = Math.round(
          Number(booking.merchantPayoutAmount) * 100,
        );
        const transfer = await createTransfer({
          amount: transferAmount,
          currency: "aud",
          destination: booking.venue.merchant.stripeConnectAccountId,
          transferGroup: `booking_${bookingId}`,
        });

        await createMerchantPayoutRecord({
          bookingId,
          merchantId: booking.venue.merchant.id,
          amount: Number(booking.merchantPayoutAmount),
          stripeTransferId: transfer.id,
        });
      }
    }

    // If this is a book_create flow, make the session visible
    const sessionId = checkoutSession.metadata?.sessionId;
    if (sessionId && checkoutSession.metadata?.type === "book_create") {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { isVisible: true },
      });
      if (session && !session.isVisible) {
        await makeSessionVisible(sessionId);
      }
    }

    return { success: true, data: null };
  } catch (error) {
    console.error("[complete-booking.completeBooking]", {
      stripeCheckoutSessionId,
      error,
    });
    return { success: false, error: "Failed to complete booking" };
  }
}

export async function processRefund(
  bookingId: string,
): Promise<ServiceResult<null>> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        playerShares: true,
      },
    });
    if (!booking) {
      return { success: false, error: "Booking not found", code: "NOT_FOUND" };
    }

    // Refund each paid share
    for (const share of booking.playerShares) {
      if (share.status === "PAID" && share.stripePaymentIntentId) {
        await createRefund({
          paymentIntentId: share.stripePaymentIntentId,
        });
      }
    }

    return processBookingRefund({ bookingId });
  } catch (error) {
    console.error("[complete-booking.processRefund]", { bookingId, error });
    return { success: false, error: "Failed to process refund" };
  }
}
