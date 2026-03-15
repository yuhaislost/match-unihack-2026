import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/nav/bottom-nav";
import { findUserByAuthId } from "@/lib/services/auth";
import { createServerSupabaseClient } from "@/lib/supabase";

const PLAYER_NAV_ITEMS = [
  { label: "Explore", href: "/explore", icon: "compass" },
  { label: "Sessions", href: "/sessions", icon: "calendar-days" },
  { label: "Profile", href: "/profile", icon: "user" },
];

export default async function PlayerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
  if (appUser.role !== "PLAYER") {
    redirect("/dashboard");
  }
  if (!appUser.playerProfile) {
    redirect("/onboarding/player-profile");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex-1">{children}</main>
      <BottomNav items={PLAYER_NAV_ITEMS} />
    </div>
  );
}
