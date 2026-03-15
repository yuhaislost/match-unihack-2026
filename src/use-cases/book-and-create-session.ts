import "server-only";

import { prisma } from "@/lib/prisma";
import {
  addUpsellsToPlayerShare,
  createCreatorBookingRecord,
} from "@/lib/services/booking";
import { holdSlot } from "@/lib/services/court-availability";
import { createScheduleSessionFromBooking } from "@/lib/services/session";
import { createCheckoutSession } from "@/lib/stripe";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export async function bookAndCreateSession(params: {
  creatorId: string;
  venueId: string;
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
  gameType: "SINGLES" | "DOUBLES";
  preferredSkillMin?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  preferredSkillMax?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  upsells?: Array<{ upsellItemId: string; quantity: number }>;
}): Promise<
  ServiceResult<{ checkoutUrl: string; sessionId: string; holdId: string }>
> {
  try {
    // Validate court belongs to venue
    const court = await prisma.court.findUnique({
      where: { id: params.courtId },
      include: { venue: { select: { id: true, name: true } } },
    });
    if (!court || court.venueId !== params.venueId || court.deletedAt) {
      return {
        success: false,
        error: "Invalid venue/court combination",
        code: "BAD_REQUEST",
      };
    }

    // Hold the slot
    const holdResult = await holdSlot({
      courtId: params.courtId,
      date: params.date,
      startTime: params.startTime,
      endTime: params.endTime,
      heldById: params.creatorId,
    });
    if (!holdResult.success) {
      return { success: false, error: holdResult.error, code: holdResult.code };
    }

    // Build full datetime values
    const scheduledStartTime = new Date(
      `${params.date}T${params.startTime}:00`,
    );
    const scheduledEndTime = new Date(`${params.date}T${params.endTime}:00`);

    // Create session (invisible until payment confirmed)
    const sessionResult = await createScheduleSessionFromBooking({
      creatorId: params.creatorId,
      gameType: params.gameType,
      skillMin: params.preferredSkillMin,
      skillMax: params.preferredSkillMax,
      venueId: params.venueId,
      courtId: params.courtId,
      scheduledStartTime,
      scheduledEndTime,
      isVisible: false,
    });
    if (!sessionResult.success) {
      return { success: false, error: sessionResult.error };
    }

    // Link hold to session
    await prisma.courtSlotHold.update({
      where: { id: holdResult.data.holdId },
      data: { sessionId: sessionResult.data.sessionId },
    });

    // Create booking (creator pays full amount)
    const bookingResult = await createCreatorBookingRecord({
      sessionId: sessionResult.data.sessionId,
      venueId: params.venueId,
      courtId: params.courtId,
      startTime: scheduledStartTime,
      endTime: scheduledEndTime,
      creatorId: params.creatorId,
      courtHourlyRate: Number(court.hourlyRate),
    });
    if (!bookingResult.success) {
      return { success: false, error: bookingResult.error };
    }

    // Add upsells if any
    if (params.upsells && params.upsells.length > 0) {
      await addUpsellsToPlayerShare({
        bookingId: bookingResult.data.bookingId,
        playerId: params.creatorId,
        upsells: params.upsells,
      });
    }

    // Re-fetch booking for checkout amounts
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingResult.data.bookingId },
      include: {
        playerShares: {
          where: { playerId: params.creatorId },
          include: { upsells: true },
        },
      },
    });

    const playerShare = booking.playerShares[0];
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const lineItems: Array<{
      price_data: {
        currency: string;
        product_data: { name: string; description: string };
        unit_amount: number;
      };
      quantity: number;
    }> = [
      {
        price_data: {
          currency: "aud",
          product_data: {
            name: `Court booking — ${court.venue.name}`,
            description: `${court.name} · Full court cost`,
          },
          unit_amount: Math.round(Number(playerShare.courtShareAmount) * 100),
        },
        quantity: 1,
      },
    ];

    for (const upsell of playerShare.upsells) {
      lineItems.push({
        price_data: {
          currency: "aud",
          product_data: {
            name: upsell.name,
            description: "Add-on",
          },
          unit_amount: Math.round(Number(upsell.price) * 100),
        },
        quantity: upsell.quantity,
      });
    }

    const checkoutSession = await createCheckoutSession({
      lineItems,
      successUrl: `${baseUrl}/explore?booking=success&session=${sessionResult.data.sessionId}`,
      cancelUrl: `${baseUrl}/explore?booking=cancelled&session=${sessionResult.data.sessionId}`,
      metadata: {
        type: "book_create",
        bookingId: bookingResult.data.bookingId,
        playerId: params.creatorId,
        sessionId: sessionResult.data.sessionId,
        holdId: holdResult.data.holdId,
      },
    });

    await prisma.booking.update({
      where: { id: bookingResult.data.bookingId },
      data: { stripeCheckoutSessionId: checkoutSession.id },
    });

    if (!checkoutSession.url) {
      return { success: false, error: "Failed to create checkout URL" };
    }

    return {
      success: true,
      data: {
        checkoutUrl: checkoutSession.url,
        sessionId: sessionResult.data.sessionId,
        holdId: holdResult.data.holdId,
      },
    };
  } catch (error) {
    console.error("[book-and-create-session.bookAndCreateSession]", {
      creatorId: params.creatorId,
      error,
    });
    return { success: false, error: "Failed to book and create session" };
  }
}
