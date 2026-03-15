import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/nav/bottom-nav";
import { findUserByAuthId } from "@/lib/services/auth";
import { createServerSupabaseClient } from "@/lib/supabase";

const MERCHANT_NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
  { label: "Courts", href: "/courts", icon: "map-pin" },
  { label: "Upsells", href: "/upsells", icon: "shopping-bag" },
];

export default async function MerchantLayout({
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
  if (appUser.role !== "MERCHANT") {
    redirect("/explore");
  }
  if (!appUser.merchantProfile) {
    redirect("/onboarding/merchant-profile");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex-1 pb-16">{children}</main>
      <BottomNav items={MERCHANT_NAV_ITEMS} />
    </div>
  );
}
