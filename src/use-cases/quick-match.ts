import "server-only";

import { prisma } from "@/lib/prisma";
import { createDeclineCooldown, isCoolingDown } from "@/lib/services/cooldown";
import {
  CONFIRMATION_TIMEOUT_MS,
  dequeue,
  enqueue,
  findAutoMatchCandidate,
  getActiveQueueEntry,
  hasOutgoingManualRequest,
  isPlayerLocked,
  scoreCandidate,
} from "@/lib/services/matching";
import {
  createQuickMatchSession,
  updateSessionPlayerStatus,
  updateSessionStatus,
} from "@/lib/services/session";
import { initVenueSelection } from "@/use-cases/venue-selection";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export async function enqueueAndAutoMatch(
  playerId: string,
  gameType: "SINGLES" | "DOUBLES" = "SINGLES",
  latitude?: number,
  longitude?: number,
): Promise<
  ServiceResult<{
    queueEntryId: string;
    autoMatchRequestId: string | null;
  }>
> {
  try {
    // Sync browser geolocation to player profile if provided
    if (latitude !== undefined && longitude !== undefined) {
      await prisma.playerProfile.update({
        where: { userId: playerId },
        data: { latitude, longitude },
      });
    }

    // If already in queue, return the existing entry (idempotent)
    const existing = await getActiveQueueEntry(playerId);
    if (existing) {
      return {
        success: true,
        data: { queueEntryId: existing.id, autoMatchRequestId: null },
      };
    }

    // Enqueue
    const enqueueResult = await enqueue(playerId, gameType);
    if (!enqueueResult.success) {
      return {
        success: false,
        error: enqueueResult.error,
        code: enqueueResult.code,
      };
    }

    // Reactive auto-match scan
    const candidate = await findAutoMatchCandidate(playerId);
    if (!candidate) {
      return {
        success: true,
        data: { queueEntryId: enqueueResult.data.id, autoMatchRequestId: null },
      };
    }

    // Create session + match request
    const sessionResult = await createQuickMatchSession(
      playerId,
      gameType,
      candidate.playerId,
    );
    if (!sessionResult.success) {
      return {
        success: true,
        data: { queueEntryId: enqueueResult.data.id, autoMatchRequestId: null },
      };
    }

    const matchRequest = await prisma.matchRequest.create({
      data: {
        sessionId: sessionResult.data.sessionId,
        requesterId: playerId,
        recipientId: candidate.playerId,
        type: "SYSTEM_AUTO",
        status: "PENDING",
        compositeScore: candidate.score,
        expiresAt: new Date(Date.now() + CONFIRMATION_TIMEOUT_MS),
      },
    });

    return {
      success: true,
      data: {
        queueEntryId: enqueueResult.data.id,
        autoMatchRequestId: matchRequest.id,
      },
    };
  } catch (error) {
    console.error("[quick-match.enqueueAndAutoMatch]", { playerId, error });
    return { success: false, error: "Failed to enqueue and auto-match" };
  }
}

export async function dequeuePlayer(
  playerId: string,
): Promise<ServiceResult<null>> {
  try {
    // Cancel any outgoing PENDING manual requests
    await prisma.matchRequest.updateMany({
      where: {
        requesterId: playerId,
        type: "MANUAL_FEED",
        status: "PENDING",
      },
      data: { status: "CANCELLED" },
    });

    return dequeue(playerId);
  } catch (error) {
    console.error("[quick-match.dequeuePlayer]", { playerId, error });
    return { success: false, error: "Failed to dequeue player" };
  }
}

export async function sendManualRequest(
  requesterId: string,
  recipientId: string,
): Promise<ServiceResult<{ requestId: string }>> {
  try {
    // Validate both in queue
    const requesterEntry = await getActiveQueueEntry(requesterId);
    if (!requesterEntry) {
      return {
        success: false,
        error: "You are not in the queue",
        code: "BAD_REQUEST",
      };
    }
    const recipientEntry = await getActiveQueueEntry(recipientId);
    if (!recipientEntry) {
      return {
        success: false,
        error: "Recipient is not in the queue",
        code: "BAD_REQUEST",
      };
    }

    // No outgoing request
    const hasOutgoing = await hasOutgoingManualRequest(requesterId);
    if (hasOutgoing) {
      return {
        success: false,
        error: "You already have a pending request",
        code: "BAD_REQUEST",
      };
    }

    // Recipient not locked
    const recipientLocked = await isPlayerLocked(recipientId);
    if (recipientLocked) {
      return {
        success: false,
        error: "Player is currently unavailable",
        code: "BAD_REQUEST",
      };
    }

    // No cooldown
    const coolingDown = await isCoolingDown(requesterId, recipientId);
    if (coolingDown) {
      return {
        success: false,
        error: "Cooldown active with this player",
        code: "BAD_REQUEST",
      };
    }

    // Score the pair
    const requesterProfile = await prisma.playerProfile.findUnique({
      where: { userId: requesterId },
    });
    const recipientProfile = await prisma.playerProfile.findUnique({
      where: { userId: recipientId },
    });

    let compositeScore = 0;
    if (requesterProfile && recipientProfile) {
      compositeScore = scoreCandidate(
        {
          latitude: Number(requesterEntry.latitude),
          longitude: Number(requesterEntry.longitude),
          searchRadiusKm: requesterEntry.searchRadiusKm,
          skillLevel: requesterEntry.skillLevel,
          avgSportsmanshipRating: Number(
            requesterProfile.avgSportsmanshipRating,
          ),
          windowStart: requesterEntry.windowStart,
          windowEnd: requesterEntry.windowEnd,
        },
        {
          latitude: Number(recipientEntry.latitude),
          longitude: Number(recipientEntry.longitude),
          searchRadiusKm: recipientEntry.searchRadiusKm,
          skillLevel: recipientEntry.skillLevel,
          avgSportsmanshipRating: Number(
            recipientProfile.avgSportsmanshipRating,
          ),
          windowStart: recipientEntry.windowStart,
          windowEnd: recipientEntry.windowEnd,
        },
      );
    }

    const matchRequest = await prisma.matchRequest.create({
      data: {
        requesterId,
        recipientId,
        type: "MANUAL_FEED",
        status: "PENDING",
        compositeScore,
        expiresAt: new Date(Date.now() + CONFIRMATION_TIMEOUT_MS),
      },
    });

    return { success: true, data: { requestId: matchRequest.id } };
  } catch (error) {
    console.error("[quick-match.sendManualRequest]", {
      requesterId,
      recipientId,
      error,
    });
    return { success: false, error: "Failed to send match request" };
  }
}

export async function respondToRequest(
  playerId: string,
  requestId: string,
  action: "ACCEPT" | "DECLINE",
): Promise<ServiceResult<{ sessionId?: string }>> {
  try {
    const request = await prisma.matchRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      return { success: false, error: "Request not found", code: "NOT_FOUND" };
    }
    if (request.status !== "PENDING") {
      return {
        success: false,
        error: "Request is no longer pending",
        code: "BAD_REQUEST",
      };
    }
    if (new Date() > request.expiresAt) {
      await prisma.matchRequest.update({
        where: { id: requestId },
        data: { status: "TIMEOUT" },
      });
      return {
        success: false,
        error: "Request has expired",
        code: "BAD_REQUEST",
      };
    }

    // Verify the player is involved
    const isRequester = request.requesterId === playerId;
    const isRecipient = request.recipientId === playerId;
    if (!isRequester && !isRecipient) {
      return { success: false, error: "Not authorized", code: "FORBIDDEN" };
    }

    if (action === "DECLINE") {
      await prisma.matchRequest.update({
        where: { id: requestId },
        data: { status: "DECLINED", respondedAt: new Date() },
      });

      // Cancel session if exists
      if (request.sessionId) {
        await updateSessionStatus(request.sessionId, "CANCELLED");
      }

      // Apply cooldown
      const otherPlayerId = isRequester
        ? request.recipientId
        : request.requesterId;
      await createDeclineCooldown(playerId, otherPlayerId);

      return { success: true, data: {} };
    }

    // ACCEPT
    if (request.type === "MANUAL_FEED") {
      // Create session, dequeue both, set request ACCEPTED
      const sessionResult = await createQuickMatchSession(
        request.requesterId,
        "SINGLES",
        request.recipientId,
      );
      if (!sessionResult.success) {
        return { success: false, error: sessionResult.error };
      }

      await prisma.matchRequest.update({
        where: { id: requestId },
        data: {
          status: "ACCEPTED",
          respondedAt: new Date(),
          sessionId: sessionResult.data.sessionId,
        },
      });

      // Update session to MATCHED and both players to CONFIRMED
      await updateSessionStatus(sessionResult.data.sessionId, "MATCHED");
      await updateSessionPlayerStatus(
        sessionResult.data.sessionId,
        request.requesterId,
        "CONFIRMED",
      );
      await updateSessionPlayerStatus(
        sessionResult.data.sessionId,
        request.recipientId,
        "CONFIRMED",
      );

      await dequeue(request.requesterId);
      await dequeue(request.recipientId);

      // Auto-trigger venue selection
      await initVenueSelection(sessionResult.data.sessionId);

      return {
        success: true,
        data: { sessionId: sessionResult.data.sessionId },
      };
    }

    // SYSTEM_AUTO — mutual confirmation
    if (request.type === "SYSTEM_AUTO" && request.sessionId) {
      // Update this player's SessionPlayer to CONFIRMED
      await updateSessionPlayerStatus(request.sessionId, playerId, "CONFIRMED");

      // Check if both players have confirmed
      const sessionPlayers = await prisma.sessionPlayer.findMany({
        where: { sessionId: request.sessionId },
      });

      const allConfirmed = sessionPlayers.every(
        (sp) => sp.status === "CONFIRMED",
      );

      if (allConfirmed) {
        await prisma.matchRequest.update({
          where: { id: requestId },
          data: { status: "ACCEPTED", respondedAt: new Date() },
        });
        await updateSessionStatus(request.sessionId, "MATCHED");
        await dequeue(request.requesterId);
        await dequeue(request.recipientId);

        // Auto-trigger venue selection
        await initVenueSelection(request.sessionId);
      }

      return { success: true, data: { sessionId: request.sessionId } };
    }

    return {
      success: false,
      error: "Unhandled request type",
      code: "BAD_REQUEST",
    };
  } catch (error) {
    console.error("[quick-match.respondToRequest]", {
      playerId,
      requestId,
      action,
      error,
    });
    return { success: false, error: "Failed to respond to request" };
  }
}

export async function cancelManualRequest(
  requesterId: string,
  requestId: string,
): Promise<ServiceResult<null>> {
  try {
    const request = await prisma.matchRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      return { success: false, error: "Request not found", code: "NOT_FOUND" };
    }
    if (request.requesterId !== requesterId) {
      return { success: false, error: "Not authorized", code: "FORBIDDEN" };
    }
    if (request.status !== "PENDING") {
      return {
        success: false,
        error: "Request is no longer pending",
        code: "BAD_REQUEST",
      };
    }

    await prisma.matchRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED" },
    });

    return { success: true, data: null };
  } catch (error) {
    console.error("[quick-match.cancelManualRequest]", {
      requesterId,
      requestId,
      error,
    });
    return { success: false, error: "Failed to cancel request" };
  }
}

export async function expireTimedOutRequests(): Promise<void> {
  const now = new Date();

  // Find expired PENDING requests
  const expired = await prisma.matchRequest.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lte: now },
    },
  });

  for (const request of expired) {
    await prisma.matchRequest.update({
      where: { id: request.id },
      data: { status: "TIMEOUT" },
    });

    // Cancel related session
    if (request.sessionId) {
      await updateSessionStatus(request.sessionId, "CANCELLED");
    }
  }
}
