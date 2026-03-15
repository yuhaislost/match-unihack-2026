import { z } from "zod";

export const proposeVenueSchema = z.object({
  sessionId: z.string().uuid(),
  venueId: z.string().uuid(),
  courtId: z.string().uuid(),
});

export const voteOnProposalSchema = z.object({
  proposalId: z.string().uuid(),
  vote: z.enum(["CONFIRM", "REJECT"]),
});

export const getVenueSelectionStatusSchema = z.object({
  sessionId: z.string().uuid(),
});

export const createCheckoutSchema = z.object({
  sessionId: z.string().uuid(),
  upsells: z
    .array(
      z.object({
        upsellItemId: z.string().uuid(),
        quantity: z.number().int().min(1).max(10),
      }),
    )
    .optional(),
});

export const getBookingSchema = z.object({
  sessionId: z.string().uuid(),
});

export const connectOnboardSchema = z.object({});

export const connectStatusSchema = z.object({});
