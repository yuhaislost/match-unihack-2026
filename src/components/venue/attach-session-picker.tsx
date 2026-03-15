"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

type AttachSessionPickerProps = {
  venueId: string;
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
  onCancel: () => void;
  onSuccess: () => void;
};

export function AttachSessionPicker({
  venueId,
  courtId,
  date,
  startTime,
  endTime,
  onCancel,
  onSuccess,
}: AttachSessionPickerProps) {
  const trpc = useTRPC();

  const { data: sessions, isLoading } = useQuery(
    trpc.session.listEligibleForVenueAttach.queryOptions(),
  );

  const attachMutation = useMutation({
    ...trpc.session.attachVenue.mutationOptions(),
    onSuccess: () => {
      onSuccess();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm text-text-secondary text-center py-4">
          No eligible sessions to attach a venue to
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-xl border border-border py-3 text-sm font-medium text-text-primary hover:bg-surface-3"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold text-text-primary">
        Attach to session
      </h3>
      <p className="text-xs text-text-secondary">
        Select a session to book this venue for
      </p>

      <div className="flex flex-col gap-2">
        {sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            onClick={() =>
              attachMutation.mutate({
                sessionId: session.id,
                venueId,
                courtId,
                date,
                startTime,
                endTime,
              })
            }
            disabled={attachMutation.isPending}
            className={`rounded-lg border p-3 text-left transition-colors hover:bg-surface-3/80 disabled:opacity-50 ${
              session.isQuickMatch
                ? "border-primary/30 bg-primary/5"
                : "border-border bg-surface-3/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">
                    {session.gameType === "SINGLES" ? "Singles" : "Doubles"}
                  </span>
                  {session.isQuickMatch && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Quick Match
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-secondary mt-0.5">
                  {session.currentPlayerCount}/{session.maxPlayers} players
                </p>
              </div>
              <svg
                className="h-4 w-4 text-text-tertiary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {attachMutation.error && (
        <p className="text-xs text-danger">{attachMutation.error.message}</p>
      )}

      <button
        type="button"
        onClick={onCancel}
        className="w-full rounded-xl border border-border py-3 text-sm font-medium text-text-primary hover:bg-surface-3"
      >
        Cancel
      </button>
    </div>
  );
}
