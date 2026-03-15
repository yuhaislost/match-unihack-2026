import "server-only";

import type { SkillLevel } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveCooldowns } from "@/lib/services/cooldown";

// ─── Constants ───

export const AUTO_MATCH_THRESHOLD = 0.65;
export const CONFIRMATION_TIMEOUT_MS = 120_000; // 2 minutes

const SKILL_TIER_MAP: Record<SkillLevel, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
};

const DEFAULT_RATING_SCORE = 0.6;

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

// ─── Pure Functions ───

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function scoreCandidate(
  searcher: {
    latitude: number;
    longitude: number;
    searchRadiusKm: number;
    skillLevel: SkillLevel;
    avgSportsmanshipRating: number;
    windowStart: Date;
    windowEnd: Date;
  },
  candidate: {
    latitude: number;
    longitude: number;
    searchRadiusKm: number;
    skillLevel: SkillLevel;
    avgSportsmanshipRating: number;
    windowStart: Date;
    windowEnd: Date;
  },
): number {
  // Distance check — exclude if beyond either player's radius
  const distance = haversineDistance(
    searcher.latitude,
    searcher.longitude,
    candidate.latitude,
    candidate.longitude,
  );
  const maxRadius = Math.min(searcher.searchRadiusKm, candidate.searchRadiusKm);
  if (distance > maxRadius) return 0;

  // Availability overlap — exclude if zero overlap
  const overlapStart = Math.max(
    searcher.windowStart.getTime(),
    candidate.windowStart.getTime(),
  );
  const overlapEnd = Math.min(
    searcher.windowEnd.getTime(),
    candidate.windowEnd.getTime(),
  );
  const overlapMs = overlapEnd - overlapStart;
  if (overlapMs <= 0) return 0;

  // Availability score: overlap / max possible window (capped at 1)
  const maxWindow = Math.max(
    searcher.windowEnd.getTime() - searcher.windowStart.getTime(),
    candidate.windowEnd.getTime() - candidate.windowStart.getTime(),
  );
  const availabilityScore = Math.min(overlapMs / maxWindow, 1);

  // Distance score: 1 at 0km, 0 at maxRadius
  const distanceScore = 1 - distance / maxRadius;

  // Rating score: normalized 0-1 (rating is 0-5 scale, default 0.6 if no ratings)
  const searcherRating =
    Number(searcher.avgSportsmanshipRating) > 0
      ? Number(searcher.avgSportsmanshipRating) / 5
      : DEFAULT_RATING_SCORE;
  const candidateRating =
    Number(candidate.avgSportsmanshipRating) > 0
      ? Number(candidate.avgSportsmanshipRating) / 5
      : DEFAULT_RATING_SCORE;
  const ratingScore = (searcherRating + candidateRating) / 2;

  // Skill score: 1 if same tier, 0.5 if 1 apart, 0 if 2 apart
  const skillDiff = Math.abs(
    SKILL_TIER_MAP[searcher.skillLevel] - SKILL_TIER_MAP[candidate.skillLevel],
  );
  const skillScore = skillDiff === 0 ? 1 : skillDiff === 1 ? 0.5 : 0;

  // Composite: 0.4 × availability + 0.3 × distance + 0.2 × rating + 0.1 × skill
  return (
    0.4 * availabilityScore +
    0.3 * distanceScore +
    0.2 * ratingScore +
    0.1 * skillScore
  );
}

// ─── Queue CRUD ───

export async function enqueue(
  playerId: string,
  gameType: "SINGLES" | "DOUBLES" = "SINGLES",
): Promise<
  ServiceResult<Awaited<ReturnType<typeof prisma.quickMatchQueueEntry.create>>>
> {
  try {
    const profile = await prisma.playerProfile.findUnique({
      where: { userId: playerId },
    });
    if (!profile) {
      return {
        success: false,
        error: "Player profile not found",
        code: "NOT_FOUND",
      };
    }
    if (profile.latitude === null || profile.longitude === null) {
      return {
        success: false,
        error: "Player location not set",
        code: "BAD_REQUEST",
      };
    }

    const now = new Date();
    const windowEnd = new Date(
      now.getTime() + profile.quickMatchWindowMinutes * 60_000,
    );

    const entry = await prisma.quickMatchQueueEntry.create({
      data: {
        playerId,
        gameType,
        latitude: profile.latitude,
        longitude: profile.longitude,
        searchRadiusKm: profile.searchRadiusKm,
        skillLevel: profile.skillLevel,
        windowStart: now,
        windowEnd,
      },
    });
    return { success: true, data: entry };
  } catch (error) {
    console.error("[matching.enqueue]", { playerId, error });
    return { success: false, error: "Failed to enqueue player" };
  }
}

export async function dequeue(playerId: string): Promise<ServiceResult<null>> {
  try {
    await prisma.quickMatchQueueEntry.updateMany({
      where: { playerId, isActive: true },
      data: { isActive: false },
    });
    return { success: true, data: null };
  } catch (error) {
    console.error("[matching.dequeue]", { playerId, error });
    return { success: false, error: "Failed to dequeue player" };
  }
}

export async function getActiveQueueEntry(playerId: string) {
  return prisma.quickMatchQueueEntry.findFirst({
    where: { playerId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
}

// ─── Candidate Finding ───

export type ScoredCandidate = {
  playerId: string;
  displayName: string;
  avatarUrl: string | null;
  skillLevel: SkillLevel;
  avgSportsmanshipRating: number;
  distance: number;
  score: number;
};

export async function findCandidates(
  playerId: string,
): Promise<ScoredCandidate[]> {
  const entry = await getActiveQueueEntry(playerId);
  if (!entry) return [];

  const cooldownIds = await getActiveCooldowns(playerId);

  const excludeIds = [playerId, ...cooldownIds];

  const candidates = await prisma.quickMatchQueueEntry.findMany({
    where: {
      isActive: true,
      playerId: { notIn: excludeIds },
      gameType: entry.gameType,
      windowEnd: { gt: new Date() },
    },
    include: {
      player: {
        include: { playerProfile: true },
      },
    },
  });

  const searcher = {
    latitude: Number(entry.latitude),
    longitude: Number(entry.longitude),
    searchRadiusKm: entry.searchRadiusKm,
    skillLevel: entry.skillLevel,
    avgSportsmanshipRating: 0,
    windowStart: entry.windowStart,
    windowEnd: entry.windowEnd,
  };

  // Get searcher's rating
  const searcherProfile = await prisma.playerProfile.findUnique({
    where: { userId: playerId },
  });
  if (searcherProfile) {
    searcher.avgSportsmanshipRating = Number(
      searcherProfile.avgSportsmanshipRating,
    );
  }

  const scored: ScoredCandidate[] = [];
  for (const c of candidates) {
    if (!c.player.playerProfile) continue;

    const candidateData = {
      latitude: Number(c.latitude),
      longitude: Number(c.longitude),
      searchRadiusKm: c.searchRadiusKm,
      skillLevel: c.skillLevel,
      avgSportsmanshipRating: Number(
        c.player.playerProfile.avgSportsmanshipRating,
      ),
      windowStart: c.windowStart,
      windowEnd: c.windowEnd,
    };

    const score = scoreCandidate(searcher, candidateData);
    if (score <= 0) continue;

    scored.push({
      playerId: c.playerId,
      displayName: c.player.displayName,
      avatarUrl: c.player.avatarUrl,
      skillLevel: c.skillLevel,
      avgSportsmanshipRating: Number(
        c.player.playerProfile.avgSportsmanshipRating,
      ),
      distance: haversineDistance(
        searcher.latitude,
        searcher.longitude,
        Number(c.latitude),
        Number(c.longitude),
      ),
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

export async function findAutoMatchCandidate(
  playerId: string,
): Promise<ScoredCandidate | null> {
  const locked = await isPlayerLocked(playerId);
  if (locked) return null;

  const candidates = await findCandidates(playerId);
  if (candidates.length === 0) return null;

  const top = candidates[0];
  if (top.score < AUTO_MATCH_THRESHOLD) return null;

  // Also check if the candidate is locked
  const candidateLocked = await isPlayerLocked(top.playerId);
  if (candidateLocked) return null;

  return top;
}

export async function getQueuePlayerCount(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<number> {
  const entries = await prisma.quickMatchQueueEntry.findMany({
    where: { isActive: true },
    select: { latitude: true, longitude: true },
  });

  let count = 0;
  for (const e of entries) {
    const d = haversineDistance(
      lat,
      lng,
      Number(e.latitude),
      Number(e.longitude),
    );
    if (d <= radiusKm) count++;
  }
  return count;
}

// ─── Locking ───

export async function isPlayerLocked(playerId: string): Promise<boolean> {
  const now = new Date();

  // Has any PENDING MatchRequest as recipient
  const asRecipient = await prisma.matchRequest.count({
    where: {
      recipientId: playerId,
      status: "PENDING",
      expiresAt: { gt: now },
    },
  });
  if (asRecipient > 0) return true;

  // Has any PENDING SYSTEM_AUTO as either party
  const asAutoParty = await prisma.matchRequest.count({
    where: {
      type: "SYSTEM_AUTO",
      status: "PENDING",
      expiresAt: { gt: now },
      OR: [{ requesterId: playerId }, { recipientId: playerId }],
    },
  });
  return asAutoParty > 0;
}

// ─── Queue Player Locations (for map dots) ───

export type QueuePlayerLocation = {
  id: string;
  latitude: number;
  longitude: number;
};

export async function getQueuePlayerLocations(
  lat: number,
  lng: number,
  radiusKm: number,
  excludePlayerId: string,
): Promise<QueuePlayerLocation[]> {
  const entries = await prisma.quickMatchQueueEntry.findMany({
    where: {
      isActive: true,
      playerId: { not: excludePlayerId },
    },
    select: { playerId: true, latitude: true, longitude: true },
  });

  const results: QueuePlayerLocation[] = [];
  for (const e of entries) {
    const d = haversineDistance(
      lat,
      lng,
      Number(e.latitude),
      Number(e.longitude),
    );
    if (d <= radiusKm) {
      results.push({
        id: e.playerId,
        latitude: Number(e.latitude),
        longitude: Number(e.longitude),
      });
    }
  }
  return results;
}

export async function hasOutgoingManualRequest(
  playerId: string,
): Promise<boolean> {
  const now = new Date();
  const count = await prisma.matchRequest.count({
    where: {
      requesterId: playerId,
      type: "MANUAL_FEED",
      status: "PENDING",
      expiresAt: { gt: now },
    },
  });
  return count > 0;
}
