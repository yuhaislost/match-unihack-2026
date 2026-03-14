import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { findUserByAuthId } from "@/lib/services/auth";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  // Determine redirect destination first, then create the response with
  // cookies attached. We need a two-pass approach:
  // 1. Exchange code using a temporary cookie collector
  // 2. Create the final redirect response with all cookies applied

  // Collect cookies that Supabase sets during code exchange
  const pendingCookies: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            pendingCookies.push(cookie);
          }
        },
      },
    },
  );

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

  // Determine where to redirect based on onboarding state
  let redirectPath: string;
  const appUser = await findUserByAuthId(supabaseUser.id);

  if (!appUser) {
    redirectPath = "/onboarding/role-select";
  } else if (appUser.deletedAt) {
    redirectPath = "/login?error=account_deactivated";
  } else if (appUser.role === "PLAYER" && !appUser.playerProfile) {
    redirectPath = "/onboarding/player-profile";
  } else if (appUser.role === "MERCHANT" && !appUser.merchantProfile) {
    redirectPath = "/onboarding/merchant-profile";
  } else {
    redirectPath = appUser.role === "PLAYER" ? "/explore" : "/dashboard";
  }

  // Create the redirect response and apply all session cookies to it
  const response = NextResponse.redirect(`${origin}${redirectPath}`);
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(
      name,
      value,
      options as Parameters<typeof response.cookies.set>[2],
    );
  }

  return response;
}
