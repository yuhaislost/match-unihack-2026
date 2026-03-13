import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findUserByAuthId } from "@/lib/services/auth";
import { createServerSupabaseClient } from "@/lib/supabase";

export default async function Home() {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser) {
    redirect("/login");
  }

  const appUser = await findUserByAuthId(supabaseUser.id);
  if (!appUser) {
    redirect("/onboarding/role-select");
  }

  if (appUser.role === "MERCHANT") {
    redirect("/dashboard");
  }

  redirect("/explore");
}
