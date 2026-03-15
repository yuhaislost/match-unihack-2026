import { z } from "zod";

export const bookAndCreateSessionSchema = z.object({
  venueId: z.string().uuid(),
  courtId: z.string().uuid(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM format"),
  gameType: z.enum(["SINGLES", "DOUBLES"]),
  preferredSkillMin: z
    .enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"])
    .optional(),
  preferredSkillMax: z
    .enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"])
    .optional(),
  upsells: z
    .array(
      z.object({
        upsellItemId: z.string().uuid(),
        quantity: z.number().int().min(1).max(10),
      }),
    )
    .optional(),
});
