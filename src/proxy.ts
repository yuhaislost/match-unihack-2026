import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/login", "/auth/callback"];
const ONBOARDING_ROUTES = [
  "/onboarding/role-select",
  "/onboarding/player-profile",
  "/onboarding/merchant-profile",
];
const PLAYER_ROUTES = ["/explore", "/sessions", "/profile"];
const MERCHANT_ROUTES = ["/dashboard", "/courts", "/upsells"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes — tRPC handles its own auth via context middleware
  if (pathname.startsWith("/api/")) {
    return NextResponse.next({ request });
  }

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

  // Helper: create a redirect that preserves any refreshed session cookies
  function redirectTo(pathname: string) {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    const redirectResponse = NextResponse.redirect(url);
    // Copy any cookies that were set during token refresh
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // Unauthenticated user
  if (!user) {
    if (isPublic || pathname === "/") {
      return response;
    }
    return redirectTo("/login");
  }

  const role = user.app_metadata?.role as string | undefined;

  // Authenticated user on login page — redirect to home
  if (pathname === "/login") {
    if (!role) {
      return redirectTo("/onboarding/role-select");
    }
    return redirectTo(role === "MERCHANT" ? "/dashboard" : "/explore");
  }

  // Root page — redirect authenticated users to role-based home
  if (pathname === "/") {
    if (!role) {
      return redirectTo("/onboarding/role-select");
    }
    return redirectTo(role === "MERCHANT" ? "/dashboard" : "/explore");
  }

  // Onboarding routes — just need auth, no role check
  if (isOnboarding) {
    return response;
  }

  // Player routes — require PLAYER role
  if (isPlayerRoute && role !== "PLAYER") {
    return redirectTo(
      role === "MERCHANT" ? "/dashboard" : "/onboarding/role-select",
    );
  }

  // Merchant routes — require MERCHANT role
  if (isMerchantRoute && role !== "MERCHANT") {
    return redirectTo(
      role === "PLAYER" ? "/explore" : "/onboarding/role-select",
    );
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
