import { initTRPC, TRPCError } from "@trpc/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { User } from "@/generated/prisma/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export type TRPCContext = {
	user: User | null;
	supabaseUser: SupabaseUser | null;
};

export const createTRPCContext = async (opts: {
	headers: Headers;
}): Promise<TRPCContext> => {
	const cookieStore = await cookies();
	const supabase = createServerSupabaseClient(cookieStore);

	const {
		data: { user: supabaseUser },
	} = await supabase.auth.getUser();

	if (!supabaseUser) {
		return { user: null, supabaseUser: null };
	}

	const user = await prisma.user.findUnique({
		where: { authUserId: supabaseUser.id },
	});

	return { user, supabaseUser };
};

const t = initTRPC.context<TRPCContext>().create({});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/** Public procedure — no auth required */
export const baseProcedure = t.procedure;

/** Requires authenticated user with a DB record */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
	if (!ctx.user) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
	}
	if (ctx.user.deletedAt) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Account has been deactivated",
		});
	}
	return next({ ctx: { user: ctx.user, supabaseUser: ctx.supabaseUser! } });
});

/** Requires Supabase auth but user may not have a DB record yet (onboarding) */
export const onboardingProcedure = t.procedure.use(async ({ ctx, next }) => {
	if (!ctx.supabaseUser) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
	}
	return next({ ctx: { user: ctx.user, supabaseUser: ctx.supabaseUser } });
});

/** Requires authenticated PLAYER */
export const playerProcedure = protectedProcedure.use(async ({ ctx, next }) => {
	if (ctx.user.role !== "PLAYER") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Player access required",
		});
	}
	return next({ ctx });
});

/** Requires authenticated MERCHANT */
export const merchantProcedure = protectedProcedure.use(
	async ({ ctx, next }) => {
		if (ctx.user.role !== "MERCHANT") {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "Merchant access required",
			});
		}
		return next({ ctx });
	},
);
