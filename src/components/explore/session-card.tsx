"use client";

import { format } from "date-fns";
import Image from "next/image";

type SessionCardProps = {
  gameType: string;
  scheduledStartTime: string;
  currentPlayerCount: number;
  maxPlayers: number;
  preferredSkillMin: string | null;
  preferredSkillMax: string | null;
  distance: number;
  creator: {
    displayName: string;
    avatarUrl: string | null;
  };
  onClick?: () => void;
};

function formatSkillRange(min: string | null, max: string | null): string {
  if (!min && !max) return "Any skill";
  if (min === max) return capitalize(min ?? "");
  return `${capitalize(min ?? "Any")}–${capitalize(max ?? "Any")}`;
}

function capitalize(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export function SessionCard({
  gameType,
  scheduledStartTime,
  currentPlayerCount,
  maxPlayers,
  preferredSkillMin,
  preferredSkillMax,
  distance,
  creator,
  onClick,
}: SessionCardProps) {
  const startDate = new Date(scheduledStartTime);
  const timeLabel = format(startDate, "EEE, MMM d · h:mm a");
  const gameLabel = gameType === "SINGLES" ? "Singles" : "Doubles";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full gap-3 rounded-lg border border-border-subtle bg-surface-1 p-3 text-left transition-colors hover:bg-surface-2 animate-feed-enter"
    >
      {/* Creator avatar */}
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-3">
        {creator.avatarUrl ? (
          <Image
            src={creator.avatarUrl}
            alt={creator.displayName}
            width={48}
            height={48}
            className="h-12 w-12 rounded-lg object-cover"
          />
        ) : (
          <span className="text-lg font-bold text-text-secondary">
            {creator.displayName.charAt(0)}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="truncate text-sm font-semibold text-text-primary">
          {gameLabel} · {timeLabel}
        </h3>
        <p className="mt-0.5 text-xs text-text-secondary">
          Hosted by {creator.displayName}
        </p>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-text-tertiary">
          <span className="rounded-full bg-primary-subtle px-2 py-0.5 text-xs font-medium text-primary">
            {currentPlayerCount}/{maxPlayers} players
          </span>
          <span>&middot;</span>
          <span>{formatSkillRange(preferredSkillMin, preferredSkillMax)}</span>
          <span>&middot;</span>
          <span className="text-mono">{distance}km</span>
        </div>
      </div>
    </button>
  );
}
