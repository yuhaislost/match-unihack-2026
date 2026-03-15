import { TRPCError } from "@trpc/server";
import { getSessionLobby } from "@/lib/services/schedule-match";
import {
  cancelScheduleSessionSchema,
  createScheduleSessionSchema,
  getSessionLobbySchema,
  joinScheduleSessionSchema,
  leaveScheduleSessionSchema,
  respondToAutoFillInviteSchema,
  respondToJoinRequestSchema,
} from "@/schemas/schedule-match";
import {
  createScheduleMatchSession,
  handleAutoFillResponse,
  handleCancelSession,
  handleJoinRequest,
  handleJoinResponse,
  handleLeaveSession,
} from "@/use-cases/schedule-match";
import { createTRPCRouter, playerProcedure } from "../init";

export const scheduleMatchRouter = createTRPCRouter({
  create: playerProcedure
    .input(createScheduleSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await createScheduleMatchSession(ctx.user.id, input);
      if (!result.success) {
        throw new TRPCError({
          code:
            result.code === "BAD_REQUEST"
              ? "BAD_REQUEST"
              : "INTERNAL_SERVER_ERROR",
          message: result.error,
        });
      }
      return result.data;
    }),

  join: playerProcedure
    .input(joinScheduleSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await handleJoinRequest(ctx.user.id, input.sessionId);
      if (!result.success) {
        const code =
          result.code === "NOT_FOUND"
            ? "NOT_FOUND"
            : result.code === "BAD_REQUEST"
              ? "BAD_REQUEST"
              : "INTERNAL_SERVER_ERROR";
        throw new TRPCError({ code, message: result.error });
      }
      return result.data;
    }),

  respondToJoinRequest: playerProcedure
    .input(respondToJoinRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await handleJoinResponse(
        ctx.user.id,
        input.requestId,
        input.action,
      );
      if (!result.success) {
        const code =
          result.code === "NOT_FOUND"
            ? "NOT_FOUND"
            : result.code === "FORBIDDEN"
              ? "FORBIDDEN"
              : result.code === "BAD_REQUEST"
                ? "BAD_REQUEST"
                : "INTERNAL_SERVER_ERROR";
        throw new TRPCError({ code, message: result.error });
      }
      return null;
    }),

  getLobby: playerProcedure
    .input(getSessionLobbySchema)
    .query(async ({ ctx, input }) => {
      const lobby = await getSessionLobby(input.sessionId, ctx.user.id);
      if (!lobby) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }
      return lobby;
    }),

  cancel: playerProcedure
    .input(cancelScheduleSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await handleCancelSession(ctx.user.id, input.sessionId);
      if (!result.success) {
        const code =
          result.code === "NOT_FOUND"
            ? "NOT_FOUND"
            : result.code === "FORBIDDEN"
              ? "FORBIDDEN"
              : "INTERNAL_SERVER_ERROR";
        throw new TRPCError({ code, message: result.error });
      }
      return null;
    }),

  leave: playerProcedure
    .input(leaveScheduleSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await handleLeaveSession(ctx.user.id, input.sessionId);
      if (!result.success) {
        const code =
          result.code === "NOT_FOUND"
            ? "NOT_FOUND"
            : result.code === "BAD_REQUEST"
              ? "BAD_REQUEST"
              : "INTERNAL_SERVER_ERROR";
        throw new TRPCError({ code, message: result.error });
      }
      return null;
    }),

  respondToAutoFillInvite: playerProcedure
    .input(respondToAutoFillInviteSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await handleAutoFillResponse(
        ctx.user.id,
        input.requestId,
        input.action,
      );
      if (!result.success) {
        const code =
          result.code === "NOT_FOUND"
            ? "NOT_FOUND"
            : result.code === "FORBIDDEN"
              ? "FORBIDDEN"
              : result.code === "BAD_REQUEST"
                ? "BAD_REQUEST"
                : "INTERNAL_SERVER_ERROR";
        throw new TRPCError({ code, message: result.error });
      }
      return result.data;
    }),
});
