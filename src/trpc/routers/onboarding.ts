import { TRPCError } from "@trpc/server";
import { findUserByAuthId } from "@/lib/services/auth";
import {
  completeMerchantProfileSchema,
  completePlayerProfileSchema,
  selectRoleSchema,
} from "@/schemas/onboarding";
import {
  completeMerchantOnboarding,
  completePlayerOnboarding,
  selectRole,
} from "@/use-cases/complete-onboarding";
import { createTRPCRouter, onboardingProcedure } from "../init";

export const onboardingRouter = createTRPCRouter({
  getStatus: onboardingProcedure.query(async ({ ctx }) => {
    const user = await findUserByAuthId(ctx.supabaseUser.id);
    if (!user) {
      return { step: "role-select" as const };
    }
    if (user.role === "PLAYER" && !user.playerProfile) {
      return { step: "player-profile" as const, userId: user.id };
    }
    if (user.role === "MERCHANT" && !user.merchantProfile) {
      return { step: "merchant-profile" as const, userId: user.id };
    }
    return {
      step: "complete" as const,
      userId: user.id,
      role: user.role,
    };
  }),

  selectRole: onboardingProcedure
    .input(selectRoleSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await selectRole({
        authUserId: ctx.supabaseUser.id,
        email: ctx.supabaseUser.email ?? "",
        displayName:
          ctx.supabaseUser.user_metadata?.full_name ??
          ctx.supabaseUser.email ??
          "Player",
        avatarUrl: ctx.supabaseUser.user_metadata?.avatar_url ?? null,
        role: input.role,
      });
      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error,
        });
      }
      return { role: input.role };
    }),

  completePlayerProfile: onboardingProcedure
    .input(completePlayerProfileSchema)
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      if (!user) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Select a role first",
        });
      }
      const result = await completePlayerOnboarding({
        userId: user.id,
        skillLevel: input.skillLevel,
        bio: input.bio,
        latitude: input.latitude,
        longitude: input.longitude,
      });
      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error,
        });
      }
      return result.data;
    }),

  completeMerchantProfile: onboardingProcedure
    .input(completeMerchantProfileSchema)
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      if (!user) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Select a role first",
        });
      }
      const result = await completeMerchantOnboarding({
        userId: user.id,
        businessName: input.businessName,
      });
      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error,
        });
      }
      return result.data;
    }),
});
