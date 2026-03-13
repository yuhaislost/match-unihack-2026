import { z } from "zod";

export const selectRoleSchema = z.object({
  role: z.enum(["PLAYER", "MERCHANT"]),
});

export const completePlayerProfileSchema = z.object({
  skillLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  bio: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const completeMerchantProfileSchema = z.object({
  businessName: z.string().min(1).max(200),
});
