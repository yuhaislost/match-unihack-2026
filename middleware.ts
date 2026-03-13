import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/auth/callback"];
const ONBOARDING_ROUTES = [
	"/onboarding/role-select",
	"/onboarding/player-profile",
	"/onboarding/merchant-profile",
];
const PLAYER_ROUTES = ["/explore", "/sessions", "/profile"];
const MERCHANT_ROUTES = ["/dashboard", "/courts", "/upsells"];

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	let response = NextResponse.next({ request });

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet) {
					for (const { name, value } of cookiesToSet) {
						request.cookies.set(name, value);
					}
					response = NextResponse.next({ request });
					for (const { name, value, options } of cookiesToSet) {
						response.cookies.set(name, value, options);
					}
				},
			},
		},
	);

	// Refresh the session — this triggers token refresh via @supabase/ssr
	const {
		data: { user },
	} = await supabase.auth.getUser();

	const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
	const isOnboarding = ONBOARDING_ROUTES.some((route) =>
		pathname.startsWith(route),
	);
	const isPlayerRoute = PLAYER_ROUTES.some((route) =>
		pathname.startsWith(route),
	);
	const isMerchantRoute = MERCHANT_ROUTES.some((route) =>
		pathname.startsWith(route),
	);

	// Unauthenticated user
	if (!user) {
		if (isPublic || pathname === "/") {
			return response;
		}
		const loginUrl = request.nextUrl.clone();
		loginUrl.pathname = "/login";
		return NextResponse.redirect(loginUrl);
	}

	const role = user.app_metadata?.role as string | undefined;

	// Authenticated user on login page — redirect to home
	if (pathname === "/login") {
		const home = role === "MERCHANT" ? "/dashboard" : "/explore";
		const homeUrl = request.nextUrl.clone();
		homeUrl.pathname = role ? home : "/onboarding/role-select";
		return NextResponse.redirect(homeUrl);
	}

	// Root page — redirect authenticated users to role-based home
	if (pathname === "/") {
		const homeUrl = request.nextUrl.clone();
		if (!role) {
			homeUrl.pathname = "/onboarding/role-select";
		} else {
			homeUrl.pathname = role === "MERCHANT" ? "/dashboard" : "/explore";
		}
		return NextResponse.redirect(homeUrl);
	}

	// Onboarding routes — just need auth, no role check
	if (isOnboarding) {
		return response;
	}

	// Player routes — require PLAYER role
	if (isPlayerRoute && role !== "PLAYER") {
		const redirectUrl = request.nextUrl.clone();
		redirectUrl.pathname =
			role === "MERCHANT" ? "/dashboard" : "/onboarding/role-select";
		return NextResponse.redirect(redirectUrl);
	}

	// Merchant routes — require MERCHANT role
	if (isMerchantRoute && role !== "MERCHANT") {
		const redirectUrl = request.nextUrl.clone();
		redirectUrl.pathname =
			role === "PLAYER" ? "/explore" : "/onboarding/role-select";
		return NextResponse.redirect(redirectUrl);
	}

	return response;
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * - public files (images, etc.)
		 */
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};
