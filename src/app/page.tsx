import { cookies } from "next/headers";
import { SplashRedirect } from "@/components/splash/splash-redirect";
import { findUserByAuthId } from "@/lib/services/auth";
import { createServerSupabaseClient } from "@/lib/supabase";

export default async function Home() {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  let redirectTo = "/login";

  if (supabaseUser) {
    const appUser = await findUserByAuthId(supabaseUser.id);
    if (!appUser) {
      redirectTo = "/onboarding/role-select";
    } else if (appUser.role === "MERCHANT") {
      redirectTo = "/dashboard";
    } else {
      redirectTo = "/explore";
    }
  }

  return <SplashRedirect redirectTo={redirectTo} />;
}
