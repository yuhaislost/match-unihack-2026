import "server-only";

import type {
  GameType,
  MatchRequest,
  SkillLevel,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { scoreCandidate } from "@/lib/services/matching";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

// ─── Constants ───

const AUTOFILL_INVITE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// ─── Session Creation ───

export async function createScheduleSession(
  creatorId: string,
  input: {
    gameType: GameType;
    scheduledStartTime: string;
    scheduledEndTime: string;
    preferredSkillMin?: SkillLevel;
    preferredSkillMax?: SkillLevel;
    venueId?: string;
    courtId?: string;
    autoAccept: boolean;
  },
): Promise<ServiceResult<{ sessionId: string }>> {
  try {
    const startTime = new Date(input.scheduledStartTime);
    const endTime = new Date(input.scheduledEndTime);

    if (startTime <= new Date()) {
      return {
        success: false,
        error: "Scheduled start time must be in the future",
        code: "BAD_REQUEST",
      };
    }
    if (endTime <= startTime) {
      return {
        success: false,
        error: "End time must be after start time",
        code: "BAD_REQUEST",
      };
    }

    const maxPlayers = input.gameType === "SINGLES" ? 2 : 4;

    const session = await prisma.session.create({
      data: {
        mode: "SCHEDULE_MATCH",
        gameType: input.gameType,
        status: "OPEN",
        creatorId,
        maxPlayers,
        currentPlayerCount: 1,
        preferredSkillMin: input.preferredSkillMin ?? null,
        preferredSkillMax: input.preferredSkillMax ?? null,
        autoAccept: input.autoAccept,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        venueId: input.venueId ?? null,
        courtId: input.courtId ?? null,
        players: {
          create: {
            playerId: creatorId,
            role: "CREATOR",
            status: "CONFIRMED",
          },
        },
      },
    });

    return { success: true, data: { sessionId: session.id } };
  } catch (error) {
    console.error("[schedule-match.createScheduleSession]", {
      creatorId,
      error,
    });
    return { success: false, error: "Failed to create session" };
  }
}

// ─── Join Request ───

export async function requestToJoinSession(
  playerId: string,
  sessionId: string,
): Promise<ServiceResult<{ joined: boolean; requestId?: string }>> {
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { players: true },
    });

    if (!session) {
      return { success: false, error: "Session not found", code: "NOT_FOUND" };
    }
    if (session.mode !== "SCHEDULE_MATCH") {
      return {
        success: false,
        error: "Not a scheduled session",
        code: "BAD_REQUEST",
      };
    }
    if (session.status !== "OPEN") {
      return {
        success: false,
        error: "Session is no longer accepting players",
        code: "BAD_REQUEST",
      };
    }
    if (
      session.scheduledStartTime &&
      session.scheduledStartTime <= new Date()
    ) {
      return {
        success: false,
        error: "Session has already started",
        code: "BAD_REQUEST",
      };
    }
    if (session.currentPlayerCount >= session.maxPlayers) {
      return { success: false, error: "Session is full", code: "BAD_REQUEST" };
    }

    // Check if already a member
    const existingPlayer = session.players.find(
      (p) => p.playerId === playerId && p.status !== "LEFT",
    );
    if (existingPlayer) {
      return {
        success: false,
        error: "You are already in this session",
        code: "BAD_REQUEST",
      };
    }

    // Check for existing pending request
    const existingRequest = await prisma.matchRequest.findFirst({
      where: {
        sessionId,
        requesterId: playerId,
        type: "SCHEDULE_JOIN",
        status: "PENDING",
      },
    });
    if (existingRequest) {
      return {
        success: false,
        error: "You already have a pending join request",
        code: "BAD_REQUEST",
      };
    }

    // Auto-accept: add player directly
    if (session.autoAccept) {
      await addPlayerToSession(sessionId, playerId, "MEMBER");
      return { success: true, data: { joined: true } };
    }

    // Create join request for creator to review
    const request = await prisma.matchRequest.create({
      data: {
        sessionId,
        requesterId: playerId,
        recipientId: session.creatorId,
        type: "SCHEDULE_JOIN",
        status: "PENDING",
        expiresAt:
          session.scheduledStartTime ??
          new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return { success: true, data: { joined: false, requestId: request.id } };
  } catch (error) {
    console.error("[schedule-match.requestToJoinSession]", {
      playerId,
      sessionId,
      error,
    });
    return { success: false, error: "Failed to request join" };
  }
}

// ─── Respond to Join Request ───

export async function respondToJoinRequest(
  hostId: string,
  requestId: string,
  action: "ACCEPT" | "DECLINE",
): Promise<ServiceResult<null>> {
  try {
    const request = await prisma.matchRequest.findUnique({
      where: { id: requestId },
      include: { session: true },
    });

    if (!request) {
      return { success: false, error: "Request not found", code: "NOT_FOUND" };
    }
    if (request.type !== "SCHEDULE_JOIN") {
      return {
        success: false,
        error: "Not a schedule join request",
        code: "BAD_REQUEST",
      };
    }
    if (request.status !== "PENDING") {
      return {
        success: false,
        error: "Request is no longer pending",
        code: "BAD_REQUEST",
      };
    }
    if (request.recipientId !== hostId) {
      return { success: false, error: "Not authorized", code: "FORBIDDEN" };
    }

    if (action === "DECLINE") {
      await prisma.matchRequest.update({
        where: { id: requestId },
        data: { status: "DECLINED", respondedAt: new Date() },
      });
      return { success: true, data: null };
    }

    // ACCEPT
    const session = request.session;
    if (!session) {
      return {
        success: false,
        error: "Session not found",
        code: "NOT_FOUND",
      };
    }
    if (session.currentPlayerCount >= session.maxPlayers) {
      await prisma.matchRequest.update({
        where: { id: requestId },
        data: { status: "DECLINED", respondedAt: new Date() },
      });
      return { success: false, error: "Session is full", code: "BAD_REQUEST" };
    }

    await prisma.matchRequest.update({
      where: { id: requestId },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });

    await addPlayerToSession(session.id, request.requesterId, "MEMBER");

    return { success: true, data: null };
  } catch (error) {
    console.error("[schedule-match.respondToJoinRequest]", {
      hostId,
      requestId,
      action,
      error,
    });
    return { success: false, error: "Failed to respond to request" };
  }
}

// ─── Cancel Session ───

export async function cancelScheduleSession(
  creatorId: string,
  sessionId: string,
): Promise<ServiceResult<null>> {
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return { success: false, error: "Session not found", code: "NOT_FOUND" };
    }
    if (session.creatorId !== creatorId) {
      return { success: false, error: "Not authorized", code: "FORBIDDEN" };
    }
    if (session.status === "CANCELLED" || session.status === "COMPLETED") {
      return {
        success: false,
        error: "Session cannot be cancelled",
        code: "BAD_REQUEST",
      };
    }

    await prisma.$transaction([
      prisma.session.update({
        where: { id: sessionId },
        data: { status: "CANCELLED" },
      }),
      prisma.matchRequest.updateMany({
        where: { sessionId, status: "PENDING" },
        data: { status: "CANCELLED" },
      }),
    ]);

    return { success: true, data: null };
  } catch (error) {
    console.error("[schedule-match.cancelScheduleSession]", {
      creatorId,
      sessionId,
      error,
    });
    return { success: false, error: "Failed to cancel session" };
  }
}

// ─── Leave Session ───

export async function leaveScheduleSession(
  playerId: string,
  sessionId: string,
): Promise<ServiceResult<null>> {
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { players: true },
    });

    if (!session) {
      return { success: false, error: "Session not found", code: "NOT_FOUND" };
    }

    const playerEntry = session.players.find(
      (p) => p.playerId === playerId && p.status !== "LEFT",
    );
    if (!playerEntry) {
      return {
        success: false,
        error: "You are not in this session",
        code: "BAD_REQUEST",
      };
    }
    if (playerEntry.role === "CREATOR") {
      return {
        success: false,
        error: "Creator cannot leave — cancel the session instead",
        code: "BAD_REQUEST",
      };
    }

    await prisma.$transaction([
      prisma.sessionPlayer.update({
        where: { id: playerEntry.id },
        data: { status: "LEFT", leftAt: new Date() },
      }),
      prisma.session.update({
        where: { id: sessionId },
        data: {
          currentPlayerCount: { decrement: 1 },
          // If was MATCHED, revert to OPEN so more players can join
          ...(session.status === "MATCHED" ? { status: "OPEN" } : {}),
        },
      }),
    ]);

    return { success: true, data: null };
  } catch (error) {
    console.error("[schedule-match.leaveScheduleSession]", {
      playerId,
      sessionId,
      error,
    });
    return { success: false, error: "Failed to leave session" };
  }
}

// ─── Session Lobby ───

export async function getSessionLobby(
  sessionId: string,
  requestingUserId: string,
) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      players: {
        include: {
          player: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              playerProfile: {
                select: {
                  skillLevel: true,
                  avgSportsmanshipRating: true,
                },
              },
            },
          },
        },
      },
      venue: {
        select: {
          id: true,
          name: true,
          address: true,
        },
      },
      court: {
        select: {
          id: true,
          name: true,
          hourlyRate: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.mode !== "SCHEDULE_MATCH") return null;

  const isCreator = session.creatorId === requestingUserId;

  // Pending join requests (only visible to creator)
  let pendingRequests: Array<{
    id: string;
    requester: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
      skillLevel: SkillLevel | null;
      avgSportsmanshipRating: number;
    };
    createdAt: Date;
  }> = [];

  if (isCreator) {
    const requests = await prisma.matchRequest.findMany({
      where: {
        sessionId,
        type: "SCHEDULE_JOIN",
        status: "PENDING",
      },
      include: {
        requester: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            playerProfile: {
              select: {
                skillLevel: true,
                avgSportsmanshipRating: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    pendingRequests = requests.map((r) => ({
      id: r.id,
      requester: {
        id: r.requester.id,
        displayName: r.requester.displayName,
        avatarUrl: r.requester.avatarUrl,
        skillLevel: r.requester.playerProfile?.skillLevel ?? null,
        avgSportsmanshipRating: Number(
          r.requester.playerProfile?.avgSportsmanshipRating ?? 0,
        ),
      },
      createdAt: r.createdAt,
    }));
  }

  return {
    id: session.id,
    gameType: session.gameType,
    status: session.status,
    maxPlayers: session.maxPlayers,
    currentPlayerCount: session.currentPlayerCount,
    preferredSkillMin: session.preferredSkillMin,
    preferredSkillMax: session.preferredSkillMax,
    autoAccept: session.autoAccept,
    scheduledStartTime: session.scheduledStartTime?.toISOString() ?? null,
    scheduledEndTime: session.scheduledEndTime?.toISOString() ?? null,
    creatorId: session.creatorId,
    isCreator,
    venue: session.venue,
    court: session.court
      ? {
          id: session.court.id,
          name: session.court.name,
          hourlyRate: Number(session.court.hourlyRate),
        }
      : null,
    players: session.players
      .filter((p) => p.status !== "LEFT" && p.status !== "REMOVED")
      .map((p) => ({
        id: p.player.id,
        displayName: p.player.displayName,
        avatarUrl: p.player.avatarUrl,
        role: p.role,
        status: p.status,
        skillLevel: p.player.playerProfile?.skillLevel ?? null,
        avgSportsmanshipRating: Number(
          p.player.playerProfile?.avgSportsmanshipRating ?? 0,
        ),
      })),
    pendingRequests,
  };
}

// ─── List Pending Join Requests ───

export async function listPendingJoinRequests(
  sessionId: string,
  hostId: string,
): Promise<ServiceResult<MatchRequest[]>> {
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      return { success: false, error: "Session not found", code: "NOT_FOUND" };
    }
    if (session.creatorId !== hostId) {
      return { success: false, error: "Not authorized", code: "FORBIDDEN" };
    }

    const requests = await prisma.matchRequest.findMany({
      where: {
        sessionId,
        type: "SCHEDULE_JOIN",
        status: "PENDING",
      },
      orderBy: { createdAt: "asc" },
    });

    return { success: true, data: requests };
  } catch (error) {
    console.error("[schedule-match.listPendingJoinRequests]", {
      sessionId,
      hostId,
      error,
    });
    return { success: false, error: "Failed to list join requests" };
  }
}

// ─── Auto-Fill ───

export async function findAutoFillCandidates(
  sessionId: string,
): Promise<Array<{ playerId: string; score: number; displayName: string }>> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      players: { select: { playerId: true } },
      creator: {
        include: { playerProfile: true },
      },
    },
  });

  if (!session || !session.creator.playerProfile) return [];

  const existingPlayerIds = session.players.map((p) => p.playerId);
  const creatorProfile = session.creator.playerProfile;

  // Find players who are not already in the session
  const candidates = await prisma.playerProfile.findMany({
    where: {
      userId: { notIn: existingPlayerIds },
      latitude: { not: null },
      longitude: { not: null },
    },
    include: {
      user: {
        select: { id: true, displayName: true, deletedAt: true },
      },
    },
  });

  const now = new Date();
  const sessionStart = session.scheduledStartTime ?? now;
  const sessionEnd =
    session.scheduledEndTime ?? new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const searcher = {
    latitude: Number(creatorProfile.latitude),
    longitude: Number(creatorProfile.longitude),
    searchRadiusKm: creatorProfile.searchRadiusKm,
    skillLevel: creatorProfile.skillLevel,
    avgSportsmanshipRating: Number(creatorProfile.avgSportsmanshipRating),
    windowStart: sessionStart,
    windowEnd: sessionEnd,
  };

  const scored: Array<{
    playerId: string;
    score: number;
    displayName: string;
  }> = [];

  for (const c of candidates) {
    if (c.user.deletedAt) continue;
    if (c.latitude === null || c.longitude === null) continue;

    const candidateData = {
      latitude: Number(c.latitude),
      longitude: Number(c.longitude),
      searchRadiusKm: c.searchRadiusKm,
      skillLevel: c.skillLevel,
      avgSportsmanshipRating: Number(c.avgSportsmanshipRating),
      windowStart: sessionStart,
      windowEnd: sessionEnd,
    };

    const score = scoreCandidate(searcher, candidateData);
    if (score <= 0) continue;

    scored.push({
      playerId: c.userId,
      score,
      displayName: c.user.displayName,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

export async function sendAutoFillInvite(
  sessionId: string,
  candidateId: string,
): Promise<ServiceResult<{ requestId: string }>> {
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      return { success: false, error: "Session not found", code: "NOT_FOUND" };
    }

    // Check no existing pending invite for this candidate
    const existing = await prisma.matchRequest.findFirst({
      where: {
        sessionId,
        recipientId: candidateId,
        type: "AUTOFILL_INVITE",
        status: "PENDING",
      },
    });
    if (existing) {
      return {
        success: false,
        error: "Invite already pending",
        code: "BAD_REQUEST",
      };
    }

    const request = await prisma.matchRequest.create({
      data: {
        sessionId,
        requesterId: session.creatorId,
        recipientId: candidateId,
        type: "AUTOFILL_INVITE",
        status: "PENDING",
        expiresAt: new Date(Date.now() + AUTOFILL_INVITE_EXPIRY_MS),
      },
    });

    return { success: true, data: { requestId: request.id } };
  } catch (error) {
    console.error("[schedule-match.sendAutoFillInvite]", {
      sessionId,
      candidateId,
      error,
    });
    return { success: false, error: "Failed to send auto-fill invite" };
  }
}

export async function respondToAutoFillInvite(
  playerId: string,
  requestId: string,
  action: "ACCEPT" | "DECLINE",
): Promise<ServiceResult<{ sessionId?: string }>> {
  try {
    const request = await prisma.matchRequest.findUnique({
      where: { id: requestId },
      include: { session: true },
    });

    if (!request) {
      return { success: false, error: "Request not found", code: "NOT_FOUND" };
    }
    if (request.type !== "AUTOFILL_INVITE") {
      return {
        success: false,
        error: "Not an auto-fill invite",
        code: "BAD_REQUEST",
      };
    }
    if (request.status !== "PENDING") {
      return {
        success: false,
        error: "Invite is no longer pending",
        code: "BAD_REQUEST",
      };
    }
    if (request.recipientId !== playerId) {
      return { success: false, error: "Not authorized", code: "FORBIDDEN" };
    }
    if (new Date() > request.expiresAt) {
      await prisma.matchRequest.update({
        where: { id: requestId },
        data: { status: "TIMEOUT" },
      });
      return {
        success: false,
        error: "Invite has expired",
        code: "BAD_REQUEST",
      };
    }

    if (action === "DECLINE") {
      await prisma.matchRequest.update({
        where: { id: requestId },
        data: { status: "DECLINED", respondedAt: new Date() },
      });
      return { success: true, data: {} };
    }

    // ACCEPT
    const session = request.session;
    if (!session || session.status === "CANCELLED") {
      await prisma.matchRequest.update({
        where: { id: requestId },
        data: { status: "CANCELLED" },
      });
      return {
        success: false,
        error: "Session is no longer available",
        code: "BAD_REQUEST",
      };
    }
    if (session.currentPlayerCount >= session.maxPlayers) {
      await prisma.matchRequest.update({
        where: { id: requestId },
        data: { status: "CANCELLED" },
      });
      return { success: false, error: "Session is full", code: "BAD_REQUEST" };
    }

    await prisma.matchRequest.update({
      where: { id: requestId },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });

    await addPlayerToSession(session.id, playerId, "BACKFILL");

    return { success: true, data: { sessionId: session.id } };
  } catch (error) {
    console.error("[schedule-match.respondToAutoFillInvite]", {
      playerId,
      requestId,
      action,
      error,
    });
    return { success: false, error: "Failed to respond to invite" };
  }
}

export async function processAutoFillForSession(
  sessionId: string,
): Promise<{ sent: number; exhausted: boolean }> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.status !== "OPEN") {
    return { sent: 0, exhausted: false };
  }
  if (session.currentPlayerCount >= session.maxPlayers) {
    return { sent: 0, exhausted: false };
  }

  // Expire old invites
  await prisma.matchRequest.updateMany({
    where: {
      sessionId,
      type: "AUTOFILL_INVITE",
      status: "PENDING",
      expiresAt: { lte: new Date() },
    },
    data: { status: "TIMEOUT" },
  });

  // Check if there's already a pending invite
  const pendingInvite = await prisma.matchRequest.findFirst({
    where: {
      sessionId,
      type: "AUTOFILL_INVITE",
      status: "PENDING",
    },
  });
  if (pendingInvite) {
    return { sent: 0, exhausted: false };
  }

  // Find candidates not already invited/declined
  const alreadyContacted = await prisma.matchRequest.findMany({
    where: {
      sessionId,
      type: "AUTOFILL_INVITE",
    },
    select: { recipientId: true },
  });
  const contactedIds = alreadyContacted.map((r) => r.recipientId);

  const candidates = await findAutoFillCandidates(sessionId);
  const eligible = candidates.filter((c) => !contactedIds.includes(c.playerId));

  if (eligible.length === 0) {
    return { sent: 0, exhausted: true };
  }

  // Send invite to best candidate
  const best = eligible[0];
  const result = await sendAutoFillInvite(sessionId, best.playerId);

  return { sent: result.success ? 1 : 0, exhausted: false };
}

// ─── Helpers ───

async function addPlayerToSession(
  sessionId: string,
  playerId: string,
  role: "MEMBER" | "BACKFILL",
) {
  const updated = await prisma.$transaction(async (tx) => {
    await tx.sessionPlayer.create({
      data: {
        sessionId,
        playerId,
        role,
        status: "CONFIRMED",
      },
    });

    const session = await tx.session.update({
      where: { id: sessionId },
      data: { currentPlayerCount: { increment: 1 } },
    });

    return session;
  });

  // If full, transition to MATCHED and cancel remaining pending requests
  if (updated.currentPlayerCount >= updated.maxPlayers) {
    await prisma.$transaction([
      prisma.session.update({
        where: { id: sessionId },
        data: { status: "MATCHED" },
      }),
      prisma.matchRequest.updateMany({
        where: {
          sessionId,
          status: "PENDING",
        },
        data: { status: "CANCELLED" },
      }),
    ]);
  }
}
