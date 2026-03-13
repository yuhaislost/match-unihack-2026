import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase";
import { findUserByAuthId } from "@/lib/services/auth";

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
			<main className="flex-1 pb-16">{children}</main>
			<nav className="fixed bottom-0 left-1/2 flex h-14 w-full max-w-[var(--viewport-max)] -translate-x-1/2 items-center justify-around border-t border-border bg-background safe-area-bottom">
				<a href="/explore" className="text-small-medium text-text-secondary hover:text-text-primary">
					Explore
				</a>
				<a href="/sessions" className="text-small-medium text-text-secondary hover:text-text-primary">
					Sessions
				</a>
				<a href="/profile" className="text-small-medium text-text-secondary hover:text-text-primary">
					Profile
				</a>
			</nav>
		</div>
	);
}
