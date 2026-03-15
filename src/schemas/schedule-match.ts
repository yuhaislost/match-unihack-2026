import { z } from "zod";

export const createScheduleSessionSchema = z.object({
  gameType: z.enum(["SINGLES", "DOUBLES"]),
  scheduledStartTime: z.string().datetime(),
  scheduledEndTime: z.string().datetime(),
  preferredSkillMin: z
    .enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"])
    .optional(),
  preferredSkillMax: z
    .enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"])
    .optional(),
  venueId: z.string().uuid().optional(),
  courtId: z.string().uuid().optional(),
  autoAccept: z.boolean().default(false),
});

export const joinScheduleSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export const respondToJoinRequestSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(["ACCEPT", "DECLINE"]),
});

export const cancelScheduleSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export const leaveScheduleSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export const listJoinRequestsSchema = z.object({
  sessionId: z.string().uuid(),
});

export const getSessionLobbySchema = z.object({
  sessionId: z.string().uuid(),
});

export const respondToAutoFillInviteSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(["ACCEPT", "DECLINE"]),
});
