"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import Link from "next/link";
import { useState } from "react";
import { useTRPC } from "@/trpc/client";

const UPCOMING_STATUSES = new Set([
  "OPEN",
  "SEARCHING",
  "CONFIRMING",
  "MATCHED",
  "BOOKED",
  "IN_PROGRESS",
]);

export function SessionsList() {
  const trpc = useTRPC();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const { data: sessions } = useSuspenseQuery(
    trpc.session.listByPlayer.queryOptions({ limit: 50 }),
  );

  const upcoming = sessions.filter((s) => UPCOMING_STATUSES.has(s.status));
  const past = sessions.filter((s) => !UPCOMING_STATUSES.has(s.status));
  const displayed = tab === "upcoming" ? upcoming : past;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-text-primary">Sessions</h1>
        <Link
          href="/sessions/create"
          className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          + Create
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-surface-1 p-1">
        {(["upcoming", "past"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-surface-3 text-text-primary"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {t === "upcoming" ? "Upcoming" : "Past"}
          </button>
        ))}
      </div>

      {/* List */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="text-sm text-text-secondary">
            {tab === "upcoming"
              ? "No upcoming sessions"
              : "No past sessions yet"}
          </p>
          {tab === "upcoming" && (
            <Link
              href="/sessions/create"
              className="text-sm font-medium text-primary"
            >
              Create your first session
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {displayed.map((session) => {
            const gameLabel =
              session.gameType === "SINGLES" ? "Singles" : "Doubles";
            const timeLabel = session.scheduledStartTime
              ? format(
                  new Date(session.scheduledStartTime),
                  "EEE, MMM d · h:mm a",
                )
              : "Quick Match";

            const statusColors: Record<string, string> = {
              OPEN: "bg-success-subtle text-success",
              MATCHED: "bg-primary-subtle text-primary",
              CANCELLED: "bg-danger-subtle text-danger",
              COMPLETED: "bg-surface-3 text-text-tertiary",
              BOOKED: "bg-warning-subtle text-warning",
              IN_PROGRESS: "bg-primary-subtle text-primary",
            };

            return (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="flex flex-col gap-1.5 rounded-lg border border-border-subtle bg-surface-1 p-3 transition-colors hover:bg-surface-2"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-text-primary">
                    {gameLabel} · {timeLabel}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[session.status] ?? "bg-surface-3 text-text-secondary"}`}
                  >
                    {session.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-text-tertiary">
                  <span>
                    {session.currentPlayerCount}/{session.maxPlayers} players
                  </span>
                  <span>&middot;</span>
                  <span>
                    {session.players
                      .slice(0, 3)
                      .map((p) => p.player.displayName)
                      .join(", ")}
                    {session.players.length > 3 &&
                      ` +${session.players.length - 3}`}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
