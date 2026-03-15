import { TRPCError } from "@trpc/server";
import {
  getAvailableSlots,
  holdSlot,
  releaseHold,
} from "@/lib/services/court-availability";
import { getVenueById, listNearbyVenues } from "@/lib/services/venue";
import {
  getAvailableSlotsSchema,
  holdSlotSchema,
  releaseHoldSchema,
} from "@/schemas/court-availability";
import { getVenueByIdSchema, listNearbyVenuesSchema } from "@/schemas/venue";
import { createTRPCRouter, playerProcedure } from "../init";

export const venueRouter = createTRPCRouter({
  listNearby: playerProcedure
    .input(listNearbyVenuesSchema)
    .query(async ({ input }) => {
      const result = await listNearbyVenues(
        input.latitude,
        input.longitude,
        input.radiusKm,
      );
      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error,
        });
      }
      return result.data;
    }),

  getById: playerProcedure
    .input(getVenueByIdSchema)
    .query(async ({ input }) => {
      const result = await getVenueById(input.venueId);
      if (!result.success) {
        throw new TRPCError({
          code:
            result.code === "NOT_FOUND" ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR",
          message: result.error,
        });
      }
      return result.data;
    }),

  getAvailableSlots: playerProcedure
    .input(getAvailableSlotsSchema)
    .query(async ({ input }) => {
      const result = await getAvailableSlots({
        venueId: input.venueId,
        date: input.date,
      });
      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error,
        });
      }
      return result.data;
    }),

  holdSlot: playerProcedure
    .input(holdSlotSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await holdSlot({
        courtId: input.courtId,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        heldById: ctx.user.id,
      });
      if (!result.success) {
        throw new TRPCError({
          code: result.code === "CONFLICT" ? "CONFLICT" : "BAD_REQUEST",
          message: result.error,
        });
      }
      return result.data;
    }),

  releaseHold: playerProcedure
    .input(releaseHoldSchema)
    .mutation(async ({ input }) => {
      const result = await releaseHold(input.holdId);
      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error,
        });
      }
      return null;
    }),
});
