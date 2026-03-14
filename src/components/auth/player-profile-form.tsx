"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTRPC } from "@/trpc/client";

const SKILL_LEVELS = [
  {
    value: "BEGINNER" as const,
    label: "Beginner",
    description: "New to badminton or play casually",
  },
  {
    value: "INTERMEDIATE" as const,
    label: "Intermediate",
    description: "Comfortable with basic shots and rallies",
  },
  {
    value: "ADVANCED" as const,
    label: "Advanced",
    description: "Competitive player with strong technique",
  },
];

export function PlayerProfileForm() {
  const router = useRouter();
  const trpc = useTRPC();
  const [skillLevel, setSkillLevel] = useState<
    "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null
  >(null);
  const [bio, setBio] = useState("");

  const completeProfile = useMutation(
    trpc.onboarding.completePlayerProfile.mutationOptions(),
  );

  const handleSubmit = async () => {
    if (!skillLevel) return;
    await completeProfile.mutateAsync({
      skillLevel,
      bio: bio || undefined,
    });
    router.refresh();
    router.push("/explore");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-small-medium text-text-secondary">Skill Level</p>
        {SKILL_LEVELS.map((level) => (
          <button
            key={level.value}
            type="button"
            onClick={() => setSkillLevel(level.value)}
            className={`rounded-xl border p-3 text-left transition-colors ${
              skillLevel === level.value
                ? "border-primary bg-primary-subtle"
                : "border-border bg-surface-1 hover:bg-surface-2"
            }`}
          >
            <p className="text-body-medium">{level.label}</p>
            <p className="text-small text-text-secondary">
              {level.description}
            </p>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="bio" className="text-small-medium text-text-secondary">
          Bio (optional)
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell others about yourself..."
          maxLength={500}
          rows={3}
          className="rounded-xl border border-border bg-surface-1 p-3 text-body text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!skillLevel || completeProfile.isPending}
        className="mt-2 h-[52px] w-full rounded-xl bg-primary text-[15px] font-medium text-text-inverse transition-all duration-[var(--duration-fast)] hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
      >
        {completeProfile.isPending ? "Saving..." : "Start Playing"}
      </button>

      {completeProfile.error && (
        <p className="text-small text-center text-danger">
          {completeProfile.error.message}
        </p>
      )}
    </div>
  );
}
