import "server-only";

import type {
  GameType,
  SessionPlayerStatus,
  SessionStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { haversineDistance } from "@/lib/services/matching";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export async function createQuickMatchSession(
  creatorId: string,
  gameType: GameType,
  matchedPlayerId: string,
): Promise<ServiceResult<{ sessionId: string }>> {
  try {
    const session = await prisma.session.create({
      data: {
        mode: "QUICK_MATCH",
        gameType,
        status: "CONFIRMING",
        creatorId,
        maxPlayers: gameType === "SINGLES" ? 2 : 4,
        currentPlayerCount: 2,
        players: {
          createMany: {
            data: [
              { playerId: creatorId, role: "CREATOR", status: "PENDING" },
              { playerId: matchedPlayerId, role: "MEMBER", status: "PENDING" },
            ],
          },
        },
      },
    });
    return { success: true, data: { sessionId: session.id } };
  } catch (error) {
    console.error("[session.createQuickMatchSession]", {
      creatorId,
      matchedPlayerId,
      error,
    });
    return { success: false, error: "Failed to create session" };
  }
}

export async function getSessionById(
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
    },
  });

  if (!session) return null;

  const isParticipant = session.players.some(
    (p) => p.playerId === requestingUserId,
  );
  if (!isParticipant) return null;

  return session;
}

export async function listPlayerSessions(
  playerId: string,
  filters: { status?: SessionStatus; limit: number },
) {
  return prisma.session.findMany({
    where: {
      players: { some: { playerId } },
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: {
      players: {
        include: {
          player: {
            select: { id: true, displayName: true, avatarUrl: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: filters.limit,
  });
}

export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
): Promise<ServiceResult<null>> {
  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: { status },
    });
    return { success: true, data: null };
  } catch (error) {
    console.error("[session.updateSessionStatus]", {
      sessionId,
      status,
      error,
    });
    return { success: false, error: "Failed to update session status" };
  }
}

// ─── Open Sessions Feed ───

export type OpenSessionFeedItem = {
  id: string;
  gameType: GameType;
  scheduledStartTime: string;
  currentPlayerCount: number;
  maxPlayers: number;
  preferredSkillMin: string | null;
  preferredSkillMax: string | null;
  distance: number;
  creator: {
    displayName: string;
    avatarUrl: string | null;
  };
};

export async function listOpenSessions(
  latitude: number,
  longitude: number,
  radiusKm: number,
): Promise<OpenSessionFeedItem[]> {
  const sessions = await prisma.session.findMany({
    where: {
      mode: "SCHEDULE_MATCH",
      status: "OPEN",
      isVisible: true,
      deletedAt: null,
      scheduledStartTime: { gt: new Date() },
    },
    include: {
      creator: {
        select: {
          displayName: true,
          avatarUrl: true,
          playerProfile: {
            select: { latitude: true, longitude: true },
          },
        },
      },
    },
    orderBy: { scheduledStartTime: "asc" },
  });

  const results: OpenSessionFeedItem[] = [];
  for (const s of sessions) {
    const creatorLat = s.creator.playerProfile?.latitude;
    const creatorLng = s.creator.playerProfile?.longitude;
    if (
      creatorLat === null ||
      creatorLat === undefined ||
      creatorLng === null ||
      creatorLng === undefined
    )
      continue;

    const dist = haversineDistance(
      latitude,
      longitude,
      Number(creatorLat),
      Number(creatorLng),
    );
    if (dist > radiusKm) continue;

    results.push({
      id: s.id,
      gameType: s.gameType,
      scheduledStartTime: s.scheduledStartTime!.toISOString(),
      currentPlayerCount: s.currentPlayerCount,
      maxPlayers: s.maxPlayers,
      preferredSkillMin: s.preferredSkillMin,
      preferredSkillMax: s.preferredSkillMax,
      distance: Math.round(dist * 10) / 10,
      creator: {
        displayName: s.creator.displayName,
        avatarUrl: s.creator.avatarUrl,
      },
    });
  }

  return results;
}

// ─── Venue Selection Helpers ───

export async function setVenueSelectionDeadline(
  sessionId: string,
  deadlineMs: number,
): Promise<ServiceResult<null>> {
  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        venueSelectionDeadline: new Date(Date.now() + deadlineMs),
      },
    });
    return { success: true, data: null };
  } catch (error) {
    console.error("[session.setVenueSelectionDeadline]", {
      sessionId,
      error,
    });
    return {
      success: false,
      error: "Failed to set venue selection deadline",
    };
  }
}

export async function confirmSessionVenue(
  sessionId: string,
  venueId: string,
  courtId: string,
): Promise<ServiceResult<null>> {
  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        venueId,
        courtId,
        venueConfirmedAt: new Date(),
        status: "BOOKED",
        venueSelectionDeadline: null,
      },
    });
    return { success: true, data: null };
  } catch (error) {
    console.error("[session.confirmSessionVenue]", {
      sessionId,
      venueId,
      courtId,
      error,
    });
    return { success: false, error: "Failed to confirm session venue" };
  }
}

export async function createScheduleSessionFromBooking(params: {
  creatorId: string;
  gameType: "SINGLES" | "DOUBLES";
  skillMin?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  skillMax?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  venueId: string;
  courtId: string;
  scheduledStartTime: Date;
  scheduledEndTime: Date;
  isVisible: boolean;
}): Promise<ServiceResult<{ sessionId: string }>> {
  try {
    const session = await prisma.session.create({
      data: {
        mode: "SCHEDULE_MATCH",
        gameType: params.gameType,
        status: "OPEN",
        creatorId: params.creatorId,
        maxPlayers: params.gameType === "SINGLES" ? 2 : 4,
        currentPlayerCount: 1,
        preferredSkillMin: params.skillMin ?? null,
        preferredSkillMax: params.skillMax ?? null,
        venueId: params.venueId,
        courtId: params.courtId,
        scheduledStartTime: params.scheduledStartTime,
        scheduledEndTime: params.scheduledEndTime,
        venueConfirmedAt: new Date(),
        isVisible: params.isVisible,
        players: {
          create: {
            playerId: params.creatorId,
            role: "CREATOR",
            status: "CONFIRMED",
          },
        },
      },
    });
    return { success: true, data: { sessionId: session.id } };
  } catch (error) {
    console.error("[session.createScheduleSessionFromBooking]", {
      creatorId: params.creatorId,
      error,
    });
    return { success: false, error: "Failed to create session from booking" };
  }
}

export async function makeSessionVisible(
  sessionId: string,
): Promise<ServiceResult<null>> {
  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: { isVisible: true },
    });
    return { success: true, data: null };
  } catch (error) {
    console.error("[session.makeSessionVisible]", { sessionId, error });
    return { success: false, error: "Failed to make session visible" };
  }
}

export async function listEligibleSessionsForVenueAttach(
  playerId: string,
): Promise<
  ServiceResult<
    Array<{
      id: string;
      mode: string;
      gameType: string;
      currentPlayerCount: number;
      maxPlayers: number;
      isQuickMatch: boolean;
      createdAt: Date;
    }>
  >
> {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        venueId: null,
        status: { in: ["MATCHED", "OPEN"] },
        deletedAt: null,
        players: { some: { playerId } },
      },
      select: {
        id: true,
        mode: true,
        gameType: true,
        currentPlayerCount: true,
        maxPlayers: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const result = sessions.map((s) => ({
      ...s,
      isQuickMatch: s.mode === "QUICK_MATCH",
    }));

    // Sort: QM first, then SM
    result.sort((a, b) => {
      if (a.isQuickMatch && !b.isQuickMatch) return -1;
      if (!a.isQuickMatch && b.isQuickMatch) return 1;
      return 0;
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("[session.listEligibleSessionsForVenueAttach]", {
      playerId,
      error,
    });
    return {
      success: false,
      error: "Failed to list eligible sessions",
    };
  }
}

export async function updateSessionPlayerStatus(
  sessionId: string,
  playerId: string,
  status: SessionPlayerStatus,
): Promise<ServiceResult<null>> {
  try {
    await prisma.sessionPlayer.updateMany({
      where: { sessionId, playerId },
      data: { status },
    });
    return { success: true, data: null };
  } catch (error) {
    console.error("[session.updateSessionPlayerStatus]", {
      sessionId,
      playerId,
      status,
      error,
    });
    return { success: false, error: "Failed to update session player status" };
  }
}
