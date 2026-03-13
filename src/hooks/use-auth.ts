"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";
import type { User } from "@supabase/supabase-js";

const supabase = createBrowserClient();

export function useAuth() {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		supabase.auth.getUser().then(({ data: { user } }) => {
			setUser(user);
			setLoading(false);
		});

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setUser(session?.user ?? null);
			setLoading(false);
		});

		return () => subscription.unsubscribe();
	}, []);

	const signInWithGoogle = useCallback(() => {
		return supabase.auth.signInWithOAuth({
			provider: "google",
			options: {
				redirectTo: `${window.location.origin}/auth/callback`,
			},
		});
	}, []);

	const signInWithApple = useCallback(() => {
		return supabase.auth.signInWithOAuth({
			provider: "apple",
			options: {
				redirectTo: `${window.location.origin}/auth/callback`,
			},
		});
	}, []);

	const signOut = useCallback(async () => {
		await supabase.auth.signOut();
		window.location.href = "/login";
	}, []);

	return { user, loading, signInWithGoogle, signInWithApple, signOut };
}
