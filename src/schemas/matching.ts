import { z } from "zod";

export const enqueueSchema = z.object({
  gameType: z.enum(["SINGLES", "DOUBLES"]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const sendRequestSchema = z.object({
  recipientId: z.string().uuid(),
});

export const respondToRequestSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(["ACCEPT", "DECLINE"]),
});

export const cancelRequestSchema = z.object({
  requestId: z.string().uuid(),
});
