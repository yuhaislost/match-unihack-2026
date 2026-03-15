import "server-only";

import type { GameType, SkillLevel } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  cancelScheduleSession,
  createScheduleSession,
  leaveScheduleSession,
  processAutoFillForSession,
  requestToJoinSession,
  respondToAutoFillInvite,
  respondToJoinRequest,
} from "@/lib/services/schedule-match";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export async function createScheduleMatchSession(
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
  return createScheduleSession(creatorId, input);
}

export async function handleJoinRequest(
  playerId: string,
  sessionId: string,
): Promise<ServiceResult<{ joined: boolean; requestId?: string }>> {
  return requestToJoinSession(playerId, sessionId);
}

export async function handleJoinResponse(
  hostId: string,
  requestId: string,
  action: "ACCEPT" | "DECLINE",
): Promise<ServiceResult<null>> {
  return respondToJoinRequest(hostId, requestId, action);
}

export async function handleLeaveSession(
  playerId: string,
  sessionId: string,
): Promise<ServiceResult<null>> {
  return leaveScheduleSession(playerId, sessionId);
}

export async function handleCancelSession(
  creatorId: string,
  sessionId: string,
): Promise<ServiceResult<null>> {
  return cancelScheduleSession(creatorId, sessionId);
}

export async function handleAutoFillResponse(
  playerId: string,
  requestId: string,
  action: "ACCEPT" | "DECLINE",
): Promise<ServiceResult<{ sessionId?: string }>> {
  return respondToAutoFillInvite(playerId, requestId, action);
}

export async function runAutoFill(): Promise<{
  processed: number;
  invitesSent: number;
  exhausted: number;
}> {
  const now = new Date();
  const leadTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

  // Find OPEN schedule sessions starting within 1 hour that aren't full
  const sessions = await prisma.session.findMany({
    where: {
      mode: "SCHEDULE_MATCH",
      status: "OPEN",
      scheduledStartTime: {
        gt: now,
        lte: leadTime,
      },
      deletedAt: null,
    },
    select: { id: true, currentPlayerCount: true, maxPlayers: true },
  });

  const eligibleSessions = sessions.filter(
    (s) => s.currentPlayerCount < s.maxPlayers,
  );

  let invitesSent = 0;
  let exhausted = 0;

  for (const session of eligibleSessions) {
    const result = await processAutoFillForSession(session.id);
    invitesSent += result.sent;
    if (result.exhausted) exhausted++;
  }

  return {
    processed: eligibleSessions.length,
    invitesSent,
    exhausted,
  };
}
