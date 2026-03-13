import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { findUserByAuthId } from "@/lib/services/auth";

export async function GET(request: NextRequest) {
	const { searchParams, origin } = request.nextUrl;
	const code = searchParams.get("code");

	if (!code) {
		return NextResponse.redirect(`${origin}/login?error=missing_code`);
	}

	const cookieStore = await cookies();
	const supabase = createServerSupabaseClient(cookieStore);

	const { error } = await supabase.auth.exchangeCodeForSession(code);
	if (error) {
		console.error("[auth/callback] Code exchange failed", { error });
		return NextResponse.redirect(`${origin}/login?error=auth_failed`);
	}

	const {
		data: { user: supabaseUser },
	} = await supabase.auth.getUser();
	if (!supabaseUser) {
		return NextResponse.redirect(`${origin}/login?error=no_user`);
	}

	const appUser = await findUserByAuthId(supabaseUser.id);

	// No app user yet — start onboarding
	if (!appUser) {
		return NextResponse.redirect(`${origin}/onboarding/role-select`);
	}

	// Account deactivated
	if (appUser.deletedAt) {
		return NextResponse.redirect(`${origin}/account-deactivated`);
	}

	// Missing profile — resume onboarding
	if (appUser.role === "PLAYER" && !appUser.playerProfile) {
		return NextResponse.redirect(`${origin}/onboarding/player-profile`);
	}
	if (appUser.role === "MERCHANT" && !appUser.merchantProfile) {
		return NextResponse.redirect(`${origin}/onboarding/merchant-profile`);
	}

	// Fully onboarded — go to role-based home
	const home = appUser.role === "PLAYER" ? "/explore" : "/dashboard";
	return NextResponse.redirect(`${origin}${home}`);
}
