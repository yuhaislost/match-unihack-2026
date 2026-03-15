import { z } from "zod";
import { baseProcedure, createTRPCRouter } from "../init";
import { bookingRouter } from "./booking";
import { matchingRouter } from "./matching";
import { onboardingRouter } from "./onboarding";
import { scheduleMatchRouter } from "./schedule-match";
import { sessionRouter } from "./session";
import { venueRouter } from "./venue";

export const appRouter = createTRPCRouter({
  hello: baseProcedure
    .input(
      z.object({
        text: z.string(),
      }),
    )
    .query((opts) => {
      return {
        greeting: `hello ${opts.input.text}`,
      };
    }),
  onboarding: onboardingRouter,
  matching: matchingRouter,
  session: sessionRouter,
  scheduleMatch: scheduleMatchRouter,
  venue: venueRouter,
  booking: bookingRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
