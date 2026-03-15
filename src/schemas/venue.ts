import { z } from "zod";

export const listNearbyVenuesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusKm: z.number().min(1).max(50).default(10),
});

export const getVenueByIdSchema = z.object({
  venueId: z.string().uuid(),
});

export const suggestVenuesForSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export type ListNearbyVenuesInput = z.infer<typeof listNearbyVenuesSchema>;
