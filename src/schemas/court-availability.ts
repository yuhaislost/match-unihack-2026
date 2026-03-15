import { z } from "zod";

export const getAvailableSlotsSchema = z.object({
  venueId: z.string().uuid(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
});

export const holdSlotSchema = z.object({
  courtId: z.string().uuid(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM format"),
});

export const releaseHoldSchema = z.object({
  holdId: z.string().uuid(),
});
