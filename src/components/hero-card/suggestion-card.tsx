"use client";

import Image from "next/image";
import type { ScoredCandidate } from "@/lib/services/matching";

export function SuggestionCard({
  candidate,
  onRequest,
  isDisabled,
}: {
  candidate: ScoredCandidate;
  onRequest: () => void;
  isDisabled: boolean;
}) {
  const skillColors: Record<string, string> = {
    BEGINNER: "bg-green-500/15 text-green-400",
    INTERMEDIATE: "bg-yellow-500/15 text-yellow-400",
    ADVANCED: "bg-red-500/15 text-red-400",
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 animate-feed-enter">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-3">
        {candidate.avatarUrl ? (
          <Image
            src={candidate.avatarUrl}
            alt={candidate.displayName}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <span className="text-sm font-bold text-text-secondary">
            {candidate.displayName.charAt(0)}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-semibold text-text-primary">
          {candidate.displayName}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${skillColors[candidate.skillLevel] ?? "bg-surface-3 text-text-secondary"}`}
          >
            {candidate.skillLevel.charAt(0) +
              candidate.skillLevel.slice(1).toLowerCase()}
          </span>
          <span className="text-xs text-text-tertiary">
            {candidate.distance < 1
              ? `${Math.round(candidate.distance * 1000)}m`
              : `${candidate.distance.toFixed(1)}km`}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onRequest}
        disabled={isDisabled}
        className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        Request
      </button>
    </div>
  );
}
