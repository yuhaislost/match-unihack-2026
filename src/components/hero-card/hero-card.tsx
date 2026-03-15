"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useHeroCard } from "./use-hero-card";

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m remaining`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function PlayerAvatar({
  avatarUrl,
  displayName,
  size = 40,
}: {
  avatarUrl: string | null;
  displayName: string;
  size?: number;
}) {
  const sizeClass =
    size === 40 ? "h-10 w-10" : size === 36 ? "h-9 w-9" : "h-10 w-10";
  return (
    <div
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-surface-3`}
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={displayName}
          width={size}
          height={size}
          className={`${sizeClass} rounded-full object-cover`}
        />
      ) : (
        <span className="text-sm font-bold text-text-secondary">
          {displayName.charAt(0)}
        </span>
      )}
    </div>
  );
}

function SkillBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    BEGINNER: "bg-green-500/15 text-green-400",
    INTERMEDIATE: "bg-yellow-500/15 text-yellow-400",
    ADVANCED: "bg-red-500/15 text-red-400",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[level] ?? "bg-surface-3 text-text-secondary"}`}
    >
      {level.charAt(0) + level.slice(1).toLowerCase()}
    </span>
  );
}

/** Animated wrapper — fades + slides content in on mount */
function StatePanel({
  children,
  stateKey,
}: {
  children: React.ReactNode;
  stateKey: string;
}) {
  return (
    <div key={stateKey} className="hero-state-enter">
      {children}
    </div>
  );
}

/** Collapsed mini bar — shows state-aware summary, tapping re-expands */
function CollapsedBar({
  state,
  gameType,
  countdown,
  onTap,
}: {
  state: import("./types").HeroCardState;
  gameType: "SINGLES" | "DOUBLES";
  countdown: number;
  onTap: () => void;
}) {
  const icon = (() => {
    switch (state.kind) {
      case "SEARCHING":
        return (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        );
      case "PENDING_REQUEST":
        return (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        );
      case "CONFIRMING":
        return (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        );
      case "MATCHED":
        return (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        );
      case "VENUE_SELECTION":
        return (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
        );
      case "BOOKED":
        return (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        );
      default:
        return (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
        );
    }
  })();

  const label = (() => {
    switch (state.kind) {
      case "CONFIGURE":
        return "Quick match";
      case "SEARCHING":
        return "Searching...";
      case "PENDING_REQUEST":
        return `Waiting for ${state.otherPlayer.displayName}`;
      case "CONFIRMING":
        return "Match found!";
      case "MATCHED":
        return "You\u2019re matched!";
      case "VENUE_SELECTION":
        return "Pick a venue";
      case "BOOKED":
        return "Venue booked";
      default:
        return "Quick match";
    }
  })();

  const subtitle = (() => {
    switch (state.kind) {
      case "SEARCHING":
        return gameType === "SINGLES" ? "Singles" : "Doubles";
      case "PENDING_REQUEST":
      case "CONFIRMING":
        return countdown > 0 ? formatCountdown(countdown) : "";
      case "MATCHED":
        return "Tap to view";
      case "VENUE_SELECTION":
        return countdown > 0 ? formatCountdown(countdown) : "";
      case "BOOKED":
        return "Tap to pay";
      default:
        return "Tap to expand";
    }
  })();

  return (
    <StatePanel stateKey="collapsed">
      <button
        type="button"
        onClick={onTap}
        className="flex w-full items-center gap-3 px-4 py-3"
      >
        {icon}
        <div className="flex-1 text-left min-w-0">
          <span className="text-sm font-semibold text-text-primary truncate block">
            {label}
          </span>
        </div>
        {subtitle && (
          <span className="shrink-0 text-xs text-text-tertiary">
            {subtitle}
          </span>
        )}
        <svg
          className="h-4 w-4 shrink-0 text-text-tertiary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 15l7-7 7 7"
          />
        </svg>
      </button>
    </StatePanel>
  );
}

export function HeroCard() {
  const { state, countdown, gameType, error, collapsed, actions, isMutating } =
    useHeroCard();
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const initialRender = useRef(true);

  // Measure content height with ResizeObserver for smooth animated transitions
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h =
          entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        setHeight(h);
      }
    });

    ro.observe(el);
    // Set initial height without animation
    setHeight(el.scrollHeight);
    // Allow animations after first paint
    requestAnimationFrame(() => {
      initialRender.current = false;
    });

    return () => ro.disconnect();
  }, []);

  // Border color + glow per state — using CSS custom properties for smooth transition
  const borderColor = (() => {
    switch (state.kind) {
      case "IDLE":
      case "CONFIGURE":
      case "SEARCHING":
      case "PENDING_REQUEST":
        return "var(--primary)";
      case "CONFIRMING":
      case "MATCHED":
      case "BOOKED":
        return "var(--success)";
      case "VENUE_SELECTION":
        return "var(--warning)";
      default:
        return "var(--primary)";
    }
  })();

  const glowClass = (() => {
    switch (state.kind) {
      case "SEARCHING":
      case "PENDING_REQUEST":
        return "animate-hero-pulse";
      case "CONFIRMING":
        return "animate-hero-pulse-green";
      default:
        return "";
    }
  })();

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-surface-2 ${glowClass}`}
      style={{
        height: height !== undefined ? height : "auto",
        borderWidth: 2,
        borderStyle: "solid",
        borderColor,
        transition: initialRender.current
          ? "none"
          : "height 350ms cubic-bezier(0.16, 1, 0.3, 1), border-color 400ms ease, box-shadow 400ms ease",
      }}
    >
      <div ref={contentRef}>
        {/* COLLAPSED — state-aware mini bar */}
        {collapsed && (
          <CollapsedBar
            state={state}
            gameType={gameType}
            countdown={countdown}
            onTap={actions.tapCard}
          />
        )}

        {/* IDLE — compact horizontal card */}
        {!collapsed && state.kind === "IDLE" && (
          <StatePanel stateKey="idle">
            <button
              type="button"
              onClick={actions.tapCard}
              className="flex w-full items-center gap-3 p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary">
                <svg
                  className="h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div className="text-left">
                <h2 className="text-body-medium font-semibold text-text-primary">
                  Quick match
                </h2>
                <p className="text-small text-text-secondary">
                  {state.nearbyPlayerCount > 0
                    ? `${state.nearbyPlayerCount} player${state.nearbyPlayerCount !== 1 ? "s" : ""} nearby now`
                    : "Tap to find a game now"}
                </p>
              </div>
            </button>
          </StatePanel>
        )}

        {/* CONFIGURE — expanded with game type selection */}
        {!collapsed && state.kind === "CONFIGURE" && (
          <StatePanel stateKey="configure">
            <div className="flex flex-col gap-4 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary">
                  <svg
                    className="h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-body-medium font-semibold text-text-primary">
                    Quick match
                  </h2>
                  <p className="text-small text-text-secondary">
                    Singles or doubles?
                  </p>
                </div>
              </div>

              {/* Game type pills */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => actions.setGameType("SINGLES")}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                    gameType === "SINGLES"
                      ? "bg-primary text-white"
                      : "border border-border text-text-secondary hover:bg-surface-3"
                  }`}
                >
                  Singles (2)
                </button>
                <button
                  type="button"
                  onClick={() => actions.setGameType("DOUBLES")}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                    gameType === "DOUBLES"
                      ? "bg-primary text-white"
                      : "border border-border text-text-secondary hover:bg-surface-3"
                  }`}
                >
                  Doubles (4)
                </button>
              </div>

              {/* Error message */}
              {error && <p className="text-small text-danger">{error}</p>}

              {/* Find a match button */}
              <button
                type="button"
                onClick={actions.findMatch}
                disabled={isMutating}
                className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-hover disabled:opacity-50"
              >
                {isMutating ? "Finding..." : "Find a match"}
              </button>
            </div>
          </StatePanel>
        )}

        {/* SEARCHING — pulsing border with bouncing dots */}
        {!collapsed && state.kind === "SEARCHING" && (
          <StatePanel stateKey="searching">
            <div className="flex flex-col items-center gap-3 p-5 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-3">
                <svg
                  className="h-5 w-5 text-text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              <div>
                <h2 className="text-body-medium font-semibold text-text-primary">
                  Searching for players...
                </h2>
                {/* Bouncing dots */}
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  <span className="animate-dot-bounce h-2 w-2 rounded-full bg-primary" />
                  <span className="animate-dot-bounce-delay-1 h-2 w-2 rounded-full bg-primary" />
                  <span className="animate-dot-bounce-delay-2 h-2 w-2 rounded-full bg-primary" />
                </div>
              </div>

              <p className="text-small text-text-secondary">
                {gameType === "SINGLES" ? "Singles" : "Doubles"} &middot;{" "}
                {countdown > 0
                  ? formatCountdown(countdown)
                  : "Waiting for server..."}
              </p>

              <button
                type="button"
                onClick={actions.cancel}
                disabled={isMutating}
                className="mt-1 w-full rounded-xl border border-border py-2.5 text-sm font-medium text-text-primary transition-colors duration-200 hover:bg-surface-3 disabled:opacity-50"
              >
                Cancel search
              </button>
            </div>
          </StatePanel>
        )}

        {/* PENDING_REQUEST — request sent, waiting */}
        {!collapsed && state.kind === "PENDING_REQUEST" && (
          <StatePanel stateKey="pending">
            <div className="flex flex-col items-center gap-3 p-5 text-center">
              <PlayerAvatar
                avatarUrl={state.otherPlayer.avatarUrl}
                displayName={state.otherPlayer.displayName}
              />
              <div>
                <h2 className="text-body-medium font-semibold text-text-primary">
                  Request sent
                </h2>
                <p className="mt-1 text-small text-text-secondary">
                  Waiting for {state.otherPlayer.displayName}...
                </p>
              </div>
              <p className="text-small text-text-tertiary">
                Expires in {formatCountdown(countdown)}
              </p>
              <button
                type="button"
                onClick={() => actions.cancelRequest(state.requestId)}
                disabled={isMutating}
                className="mt-1 w-full rounded-xl border border-border py-2.5 text-sm font-medium text-text-primary transition-colors duration-200 hover:bg-surface-3 disabled:opacity-50"
              >
                Cancel request
              </button>
            </div>
          </StatePanel>
        )}

        {/* CONFIRMING — match found, green border */}
        {!collapsed && state.kind === "CONFIRMING" && (
          <StatePanel stateKey="confirming">
            <div className="flex flex-col gap-3 p-4 animate-match-celebrate">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success">
                  <svg
                    className="h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-body-medium font-semibold text-text-primary">
                    Match found!
                  </h2>
                  <p className="text-small text-text-secondary">
                    Waiting for confirmation...
                  </p>
                </div>
              </div>

              {/* Player info row */}
              <div className="flex items-center gap-3 rounded-lg bg-surface-3/50 p-3">
                <PlayerAvatar
                  avatarUrl={state.otherPlayer.avatarUrl}
                  displayName={state.otherPlayer.displayName}
                  size={36}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-text-primary">
                      {state.otherPlayer.displayName}
                    </span>
                    <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                      Great match
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-text-secondary">
                    {state.otherPlayer.playerProfile && (
                      <>
                        <SkillBadge
                          level={state.otherPlayer.playerProfile.skillLevel}
                        />
                        <span>&middot;</span>
                        <span>
                          {String(
                            state.otherPlayer.playerProfile
                              .avgSportsmanshipRating ?? "—",
                          )}{" "}
                          stars
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Countdown */}
              <p className="text-small text-text-tertiary">
                Expires in {formatCountdown(countdown)}
              </p>

              {/* Action buttons */}
              {state.myResponse === "PENDING" ? (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => actions.decline(state.requestId)}
                    disabled={isMutating}
                    className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-text-primary transition-colors duration-200 hover:bg-surface-3 disabled:opacity-50"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    onClick={() => actions.accept(state.requestId)}
                    disabled={isMutating}
                    className="flex-1 rounded-xl bg-success py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-success-hover disabled:opacity-50"
                  >
                    Accept
                  </button>
                </div>
              ) : (
                <p className="text-small font-medium text-success">
                  Waiting for {state.otherPlayer.displayName} to confirm...
                </p>
              )}
            </div>
          </StatePanel>
        )}

        {/* MATCHED — brief celebration before venue selection kicks in */}
        {!collapsed && state.kind === "MATCHED" && (
          <StatePanel stateKey="matched">
            <div className="flex flex-col gap-4 p-4 animate-match-celebrate">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success">
                  <svg
                    className="h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-body-medium font-semibold text-text-primary">
                    You&apos;re matched!
                  </h2>
                  <p className="text-small text-text-secondary">
                    Preparing venue selection...
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {state.players.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <PlayerAvatar
                      avatarUrl={p.avatarUrl}
                      displayName={p.displayName}
                      size={36}
                    />
                    <span className="text-sm font-medium text-text-primary">
                      {p.displayName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </StatePanel>
        )}

        {/* VENUE_SELECTION — amber border, browse prompt + inline confirm */}
        {!collapsed && state.kind === "VENUE_SELECTION" && (
          <StatePanel stateKey="venue-selection">
            <div className="flex flex-col gap-3 p-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning">
                  <svg
                    className="h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-body-medium font-semibold text-text-primary">
                    Pick a venue
                  </h2>
                  <p className="text-small text-text-secondary">
                    {countdown > 0
                      ? formatCountdown(countdown)
                      : "Browse venues to book a court"}
                  </p>
                </div>
              </div>

              {/* Inline confirm — when another player proposed a venue */}
              {state.pendingProposal && (
                <div className="rounded-lg border border-warning/50 bg-warning/5 p-3">
                  <p className="text-xs font-medium text-text-secondary mb-1">
                    Your partner suggested:
                  </p>
                  <p className="text-sm font-semibold text-text-primary">
                    {state.pendingProposal.venueName}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {state.pendingProposal.address}
                    {state.pendingProposal.hourlyRate !== null && (
                      <> &middot; ${state.pendingProposal.hourlyRate}/hr</>
                    )}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (state.pendingProposal)
                          actions.rejectVenue(state.pendingProposal.id);
                      }}
                      disabled={isMutating}
                      className="flex-1 rounded-lg border border-border py-2 text-xs font-medium text-text-primary transition-colors hover:bg-surface-3 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (state.pendingProposal)
                          actions.confirmVenue(state.pendingProposal.id);
                      }}
                      disabled={isMutating}
                      className="flex-1 rounded-lg bg-warning py-2 text-xs font-semibold text-white transition-colors hover:bg-warning/90 disabled:opacity-50"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              )}

              {/* Browse venues button */}
              {!state.pendingProposal && (
                <button
                  type="button"
                  onClick={() => actions.browseVenues(state.sessionId)}
                  className="w-full rounded-xl bg-warning py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-warning/90"
                >
                  Browse venues
                </button>
              )}
            </div>
          </StatePanel>
        )}

        {/* BOOKED — venue confirmed, pay now */}
        {!collapsed && state.kind === "BOOKED" && (
          <StatePanel stateKey="booked">
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success">
                  <svg
                    className="h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-body-medium font-semibold text-text-primary">
                    Venue booked!
                  </h2>
                  {state.venue && (
                    <p className="text-small text-text-secondary">
                      {state.venue.name}
                    </p>
                  )}
                </div>
              </div>

              {/* Venue address */}
              {state.venue && (
                <div className="rounded-lg bg-surface-3/50 p-3">
                  <p className="text-xs text-text-secondary">
                    {state.venue.address}
                  </p>
                </div>
              )}

              {/* Player avatars */}
              <div className="flex items-center gap-3">
                {state.players.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <PlayerAvatar
                      avatarUrl={p.avatarUrl}
                      displayName={p.displayName}
                      size={36}
                    />
                    <span className="text-sm font-medium text-text-primary">
                      {p.displayName}
                    </span>
                  </div>
                ))}
              </div>

              {/* Payment button */}
              {state.booking && state.booking.paymentStatus !== "PAID" && (
                <button
                  type="button"
                  onClick={() => actions.payNow(state.sessionId)}
                  disabled={isMutating}
                  className="w-full rounded-xl bg-success py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-success-hover disabled:opacity-50"
                >
                  {isMutating
                    ? "Redirecting..."
                    : `Pay $${state.booking.playerShareAmount.toFixed(2)}`}
                </button>
              )}

              {state.booking && state.booking.paymentStatus === "PAID" && (
                <div className="rounded-lg bg-success/10 p-3 text-center">
                  <p className="text-sm font-medium text-success">
                    Payment complete
                  </p>
                </div>
              )}
            </div>
          </StatePanel>
        )}
      </div>
    </div>
  );
}
