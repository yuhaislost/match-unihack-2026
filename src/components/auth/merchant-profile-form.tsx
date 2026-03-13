"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";

export function MerchantProfileForm() {
	const router = useRouter();
	const trpc = useTRPC();
	const [businessName, setBusinessName] = useState("");

	const completeProfile = useMutation(
		trpc.onboarding.completeMerchantProfile.mutationOptions(),
	);

	const handleSubmit = async () => {
		if (!businessName.trim()) return;
		await completeProfile.mutateAsync({ businessName: businessName.trim() });
		router.push("/dashboard");
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<label
					htmlFor="businessName"
					className="text-small-medium text-text-secondary"
				>
					Business Name
				</label>
				<input
					id="businessName"
					type="text"
					value={businessName}
					onChange={(e) => setBusinessName(e.target.value)}
					placeholder="e.g. City Badminton Center"
					maxLength={200}
					className="h-12 rounded-xl border border-border bg-surface-1 px-3 text-body text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none"
				/>
			</div>

			<button
				type="button"
				onClick={handleSubmit}
				disabled={!businessName.trim() || completeProfile.isPending}
				className="mt-2 h-[52px] w-full rounded-xl bg-primary text-[15px] font-medium text-text-inverse transition-all duration-[var(--duration-fast)] hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
			>
				{completeProfile.isPending ? "Saving..." : "Get Started"}
			</button>

			{completeProfile.error && (
				<p className="text-small text-center text-danger">
					{completeProfile.error.message}
				</p>
			)}
		</div>
	);
}
