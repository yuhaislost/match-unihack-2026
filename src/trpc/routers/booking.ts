import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/prisma";
import { getBookingBySessionId } from "@/lib/services/booking";
import { bookAndCreateSessionSchema } from "@/schemas/book-create-session";
import { createCheckoutSchema, getBookingSchema } from "@/schemas/booking";
import { bookAndCreateSession } from "@/use-cases/book-and-create-session";
import { initiateCheckout } from "@/use-cases/complete-booking";
import { onboardMerchant } from "@/use-cases/stripe-connect";
import { createTRPCRouter, merchantProcedure, playerProcedure } from "../init";

export const bookingRouter = createTRPCRouter({
  initiateCheckout: playerProcedure
    .input(createCheckoutSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await initiateCheckout(
        ctx.user.id,
        input.sessionId,
        input.upsells,
      );
      if (!result.success) {
        const codeMap: Record<
          string,
          "NOT_FOUND" | "FORBIDDEN" | "BAD_REQUEST"
        > = {
          NOT_FOUND: "NOT_FOUND",
          FORBIDDEN: "FORBIDDEN",
        };
        throw new TRPCError({
          code: codeMap[result.code ?? ""] ?? "BAD_REQUEST",
          message: result.error,
        });
      }
      return result.data;
    }),

  getBooking: playerProcedure
    .input(getBookingSchema)
    .query(async ({ ctx, input }) => {
      const booking = await getBookingBySessionId(input.sessionId);
      if (!booking) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Booking not found",
        });
      }

      // Validate player is part of the booking
      const isParticipant = booking.playerShares.some(
        (s) => s.playerId === ctx.user.id,
      );
      if (!isParticipant) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to view this booking",
        });
      }

      return booking;
    }),

  bookAndCreateSession: playerProcedure
    .input(bookAndCreateSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await bookAndCreateSession({
        creatorId: ctx.user.id,
        venueId: input.venueId,
        courtId: input.courtId,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        gameType: input.gameType,
        preferredSkillMin: input.preferredSkillMin,
        preferredSkillMax: input.preferredSkillMax,
        upsells: input.upsells,
      });
      if (!result.success) {
        const codeMap: Record<
          string,
          "NOT_FOUND" | "FORBIDDEN" | "BAD_REQUEST"
        > = {
          NOT_FOUND: "NOT_FOUND",
          FORBIDDEN: "FORBIDDEN",
          CONFLICT: "BAD_REQUEST",
        };
        throw new TRPCError({
          code: codeMap[result.code ?? ""] ?? "BAD_REQUEST",
          message: result.error,
        });
      }
      return result.data;
    }),

  connectOnboard: merchantProcedure.mutation(async ({ ctx }) => {
    const result = await onboardMerchant(ctx.user.id);
    if (!result.success) {
      throw new TRPCError({
        code:
          result.code === "NOT_FOUND" ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR",
        message: result.error,
      });
    }
    return result.data;
  }),

  connectStatus: merchantProcedure.query(async ({ ctx }) => {
    const merchant = await prisma.merchantProfile.findUnique({
      where: { userId: ctx.user.id },
      select: {
        stripeConnectAccountId: true,
        stripeChargesEnabled: true,
        stripeOnboardingComplete: true,
      },
    });
    if (!merchant) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Merchant profile not found",
      });
    }
    return merchant;
  }),
});
