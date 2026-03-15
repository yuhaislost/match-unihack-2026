import { z } from "zod";

export const getSessionByIdSchema = z.object({
  sessionId: z.string().uuid(),
});

export const listPlayerSessionsSchema = z.object({
  status: z
    .enum([
      "SEARCHING",
      "OPEN",
      "CONFIRMING",
      "MATCHED",
      "BOOKED",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
    ])
    .optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const listOpenSessionsSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusKm: z.number().min(1).max(50).default(10),
});
