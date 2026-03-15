import "server-only";

import { prisma } from "@/lib/prisma";
import { createBookingRecord } from "@/lib/services/booking";
import { holdSlot } from "@/lib/services/court-availability";
import { confirmSessionVenue } from "@/lib/services/session";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export async function attachVenueToSession(params: {
  playerId: string;
  sessionId: string;
  venueId: string;
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
}): Promise<ServiceResult<{ proposalId?: string; confirmed: boolean }>> {
  try {
    // Validate player is in session
    const sessionPlayer = await prisma.sessionPlayer.findFirst({
      where: { sessionId: params.sessionId, playerId: params.playerId },
    });
    if (!sessionPlayer) {
      return {
        success: false,
        error: "Player not in session",
        code: "FORBIDDEN",
      };
    }

    // Validate session has no venue
    const session = await prisma.session.findUnique({
      where: { id: params.sessionId },
      include: {
        players: true,
      },
    });
    if (!session) {
      return { success: false, error: "Session not found", code: "NOT_FOUND" };
    }
    if (session.venueId) {
      return {
        success: false,
        error: "Session already has a venue",
        code: "BAD_REQUEST",
      };
    }

    // Validate court belongs to venue
    const court = await prisma.court.findUnique({
      where: { id: params.courtId },
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
      heldById: params.playerId,
      sessionId: params.sessionId,
    });
    if (!holdResult.success) {
      return { success: false, error: holdResult.error, code: holdResult.code };
    }

    const scheduledStartTime = new Date(
      `${params.date}T${params.startTime}:00`,
    );
    const scheduledEndTime = new Date(`${params.date}T${params.endTime}:00`);

    const isScheduleMatch = session.mode === "SCHEDULE_MATCH";
    const isCreator = session.creatorId === params.playerId;

    if (isScheduleMatch && isCreator) {
      // Schedule Match + creator → confirm directly, no voting needed
      await confirmSessionVenue(
        params.sessionId,
        params.venueId,
        params.courtId,
      );

      // Update session times
      await prisma.session.update({
        where: { id: params.sessionId },
        data: {
          scheduledStartTime,
          scheduledEndTime,
        },
      });

      // Create booking with even split
      const playerIds = session.players.map((p) => p.playerId);
      await createBookingRecord({
        sessionId: params.sessionId,
        venueId: params.venueId,
        courtId: params.courtId,
        startTime: scheduledStartTime,
        endTime: scheduledEndTime,
        playerIds,
        courtHourlyRate: Number(court.hourlyRate),
      });

      return { success: true, data: { confirmed: true } };
    }

    // Quick Match → create VenueProposal, auto-cast proposer's CONFIRM vote
    const proposal = await prisma.venueProposal.create({
      data: {
        sessionId: params.sessionId,
        venueId: params.venueId,
        courtId: params.courtId,
        proposedById: params.playerId,
        price: court.hourlyRate,
        status: "PROPOSED",
      },
    });

    // Auto-cast CONFIRM vote from proposer
    await prisma.venueProposalVote.create({
      data: {
        proposalId: proposal.id,
        playerId: params.playerId,
        vote: "CONFIRM",
      },
    });

    return {
      success: true,
      data: { proposalId: proposal.id, confirmed: false },
    };
  } catch (error) {
    console.error("[attach-venue-to-session.attachVenueToSession]", {
      playerId: params.playerId,
      sessionId: params.sessionId,
      error,
    });
    return { success: false, error: "Failed to attach venue to session" };
  }
}
