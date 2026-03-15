"use client";

import { SuggestionCard } from "./suggestion-card";
import { useSuggestions } from "./use-suggestions";

export function SuggestionList({ enabled }: { enabled: boolean }) {
  const { candidates, sendRequest, isRequestPending } = useSuggestions(enabled);

  if (!enabled) return null;

  if (candidates.length === 0) {
    return (
      <div className="mt-4 rounded-xl bg-surface-2 p-4 text-center">
        <p className="text-sm text-text-secondary">
          No players found nearby yet. Hang tight!
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-text-secondary">
        Nearby Players
      </h3>
      {candidates.map((candidate) => (
        <SuggestionCard
          key={candidate.playerId}
          candidate={candidate}
          onRequest={() => sendRequest(candidate.playerId)}
          isDisabled={isRequestPending}
        />
      ))}
    </div>
  );
}
