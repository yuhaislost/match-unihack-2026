import { TRPCError } from "@trpc/server";
import {
  getSessionById,
  listEligibleSessionsForVenueAttach,
  listOpenSessions,
  listPlayerSessions,
} from "@/lib/services/session";
import { attachVenueToSessionSchema } from "@/schemas/attach-venue";
import {
  getVenueSelectionStatusSchema,
  proposeVenueSchema,
  voteOnProposalSchema,
} from "@/schemas/booking";
import {
  getSessionByIdSchema,
  listOpenSessionsSchema,
  listPlayerSessionsSchema,
} from "@/schemas/session";
import { attachVenueToSession } from "@/use-cases/attach-venue-to-session";
import {
  getVenueSelectionState,
  proposeVenue,
  voteOnProposal,
} from "@/use-cases/venue-selection";
import { createTRPCRouter, playerProcedure } from "../init";

export const sessionRouter = createTRPCRouter({
  getById: playerProcedure
    .input(getSessionByIdSchema)
    .query(async ({ ctx, input }) => {
      const session = await getSessionById(input.sessionId, ctx.user.id);
      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }
      return session;
    }),

  listByPlayer: playerProcedure
    .input(listPlayerSessionsSchema)
    .query(async ({ ctx, input }) => {
      return listPlayerSessions(ctx.user.id, input);
    }),

  listOpenNearby: playerProcedure
    .input(listOpenSessionsSchema)
    .query(async ({ input }) => {
      return listOpenSessions(input.latitude, input.longitude, input.radiusKm);
    }),

  getVenueSelectionStatus: playerProcedure
    .input(getVenueSelectionStatusSchema)
    .query(async ({ ctx, input }) => {
      const result = await getVenueSelectionState(input.sessionId, ctx.user.id);
      if (!result.success) {
        throw new TRPCError({
          code:
            result.code === "NOT_FOUND" ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR",
          message: result.error,
        });
      }
      return result.data;
    }),

  proposeVenue: playerProcedure
    .input(proposeVenueSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await proposeVenue(
        ctx.user.id,
        input.sessionId,
        input.venueId,
        input.courtId,
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

  voteOnProposal: playerProcedure
    .input(voteOnProposalSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await voteOnProposal(
        ctx.user.id,
        input.proposalId,
        input.vote,
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

  listEligibleForVenueAttach: playerProcedure.query(async ({ ctx }) => {
    const result = await listEligibleSessionsForVenueAttach(ctx.user.id);
    if (!result.success) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: result.error,
      });
    }
    return result.data;
  }),

  attachVenue: playerProcedure
    .input(attachVenueToSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await attachVenueToSession({
        playerId: ctx.user.id,
        sessionId: input.sessionId,
        venueId: input.venueId,
        courtId: input.courtId,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
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
});
