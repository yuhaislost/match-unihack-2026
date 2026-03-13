"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";

export function RoleSelectForm() {
	const router = useRouter();
	const trpc = useTRPC();
	const [selected, setSelected] = useState<"PLAYER" | "MERCHANT" | null>(null);

	const selectRole = useMutation(
		trpc.onboarding.selectRole.mutationOptions(),
	);

	const handleContinue = async () => {
		if (!selected) return;
		await selectRole.mutateAsync({ role: selected });
		if (selected === "PLAYER") {
			router.push("/onboarding/player-profile");
		} else {
			router.push("/onboarding/merchant-profile");
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<button
				type="button"
				onClick={() => setSelected("PLAYER")}
				className={`rounded-xl border p-4 text-left transition-colors ${
					selected === "PLAYER"
						? "border-primary bg-primary-subtle"
						: "border-border bg-surface-1 hover:bg-surface-2"
				}`}
			>
				<p className="text-title mb-1">Player</p>
				<p className="text-small text-text-secondary">
					Find matches, book courts, and play badminton.
				</p>
			</button>

			<button
				type="button"
				onClick={() => setSelected("MERCHANT")}
				className={`rounded-xl border p-4 text-left transition-colors ${
					selected === "MERCHANT"
						? "border-primary bg-primary-subtle"
						: "border-border bg-surface-1 hover:bg-surface-2"
				}`}
			>
				<p className="text-title mb-1">Venue Owner</p>
				<p className="text-small text-text-secondary">
					List your courts, manage bookings, and earn revenue.
				</p>
			</button>

			<button
				type="button"
				onClick={handleContinue}
				disabled={!selected || selectRole.isPending}
				className="mt-2 h-[52px] w-full rounded-xl bg-primary text-[15px] font-medium text-text-inverse transition-all duration-[var(--duration-fast)] hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
			>
				{selectRole.isPending ? "Setting up..." : "Continue"}
			</button>

			{selectRole.error && (
				<p className="text-small text-center text-danger">
					{selectRole.error.message}
				</p>
			)}
		</div>
	);
}
