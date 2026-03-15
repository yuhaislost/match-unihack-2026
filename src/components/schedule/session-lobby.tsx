"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { format } from "date-fns";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSessionSubscription } from "@/hooks/use-session-subscription";
import { useTRPC } from "@/trpc/client";
import { JoinRequestCard } from "./join-request-card";

type SessionLobbyProps = {
  sessionId: string;
};

export function SessionLobby({ sessionId }: SessionLobbyProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  useSessionSubscription(sessionId);

  const { data: lobby } = useSuspenseQuery(
    trpc.scheduleMatch.getLobby.queryOptions({ sessionId }),
  );

  const lobbyQueryKey = trpc.scheduleMatch.getLobby.queryOptions({
    sessionId,
  }).queryKey;

  const cancelMutation = useMutation(
    trpc.scheduleMatch.cancel.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: lobbyQueryKey });
      },
    }),
  );

  const leaveMutation = useMutation(
    trpc.scheduleMatch.leave.mutationOptions({
      onSuccess: () => {
        router.push("/sessions");
      },
    }),
  );

  const joinMutation = useMutation(
    trpc.scheduleMatch.join.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: lobbyQueryKey });
      },
    }),
  );

  const gameLabel = lobby.gameType === "SINGLES" ? "Singles" : "Doubles";
  const timeLabel = lobby.scheduledStartTime
    ? format(new Date(lobby.scheduledStartTime), "EEE, MMM d · h:mm a")
    : "TBD";
  const endLabel = lobby.scheduledEndTime
    ? format(new Date(lobby.scheduledEndTime), "h:mm a")
    : "";

  const isParticipant = lobby.isCreator || lobby.players.length > 0;
  const canJoin =
    !isParticipant &&
    lobby.status === "OPEN" &&
    lobby.currentPlayerCount < lobby.maxPlayers;

  const statusColors: Record<string, string> = {
    OPEN: "bg-success-subtle text-success",
    MATCHED: "bg-primary-subtle text-primary",
    CANCELLED: "bg-danger-subtle text-danger",
    BOOKED: "bg-warning-subtle text-warning",
  };

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-text-primary">
            {gameLabel} Session
          </h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[lobby.status] ?? "bg-surface-3 text-text-secondary"}`}
          >
            {lobby.status}
          </span>
        </div>
        <p className="text-sm text-text-secondary">
          {timeLabel}
          {endLabel && ` – ${endLabel}`}
        </p>
        {lobby.venue && (
          <p className="text-sm text-text-tertiary">
            {lobby.venue.name} · {lobby.venue.address}
          </p>
        )}
      </div>

      {/* Skill Preference */}
      {(lobby.preferredSkillMin || lobby.preferredSkillMax) && (
        <div className="rounded-lg border border-border-subtle bg-surface-1 px-4 py-3">
          <p className="text-xs text-text-tertiary">Preferred Skill</p>
          <p className="text-sm font-medium text-text-primary">
            {formatSkillRange(lobby.preferredSkillMin, lobby.preferredSkillMax)}
          </p>
        </div>
      )}

      {/* Player Roster */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-small-medium text-text-secondary">Players</h2>
          <span className="text-xs text-text-tertiary">
            {lobby.currentPlayerCount}/{lobby.maxPlayers}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {lobby.players.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-1 p-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-3">
                {player.avatarUrl ? (
                  <Image
                    src={player.avatarUrl}
                    alt={player.displayName}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-bold text-text-secondary">
                    {player.displayName.charAt(0)}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">
                  {player.displayName}
                  {player.role === "CREATOR" && (
                    <span className="ml-1.5 text-xs text-text-tertiary">
                      Host
                    </span>
                  )}
                </p>
                <p className="text-xs text-text-tertiary">
                  {player.skillLevel
                    ? player.skillLevel.charAt(0) +
                      player.skillLevel.slice(1).toLowerCase()
                    : ""}
                </p>
              </div>
            </div>
          ))}

          {/* Empty slots */}
          {Array.from({
            length: lobby.maxPlayers - lobby.currentPlayerCount,
          }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-surface-1/50 p-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-border">
                <span className="text-xs text-text-tertiary">?</span>
              </div>
              <p className="text-sm text-text-tertiary">Waiting for player</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Join Requests (Creator only) */}
      {lobby.isCreator && lobby.pendingRequests.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-small-medium text-text-secondary">
            Join Requests ({lobby.pendingRequests.length})
          </h2>
          {lobby.pendingRequests.map((request) => (
            <JoinRequestCard
              key={request.id}
              requestId={request.id}
              sessionId={sessionId}
              requester={request.requester}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pb-4">
        {canJoin && (
          <button
            type="button"
            onClick={() => joinMutation.mutate({ sessionId })}
            disabled={joinMutation.isPending}
            className="rounded-lg bg-primary px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {joinMutation.isPending
              ? "Joining..."
              : lobby.autoAccept
                ? "Join Session"
                : "Request to Join"}
          </button>
        )}

        {joinMutation.isError && (
          <p className="text-center text-xs text-danger">
            {joinMutation.error.message}
          </p>
        )}

        {lobby.isCreator && lobby.status !== "CANCELLED" && (
          <button
            type="button"
            onClick={() => cancelMutation.mutate({ sessionId })}
            disabled={cancelMutation.isPending}
            className="rounded-lg border border-danger px-4 py-3 text-sm font-medium text-danger transition-colors hover:bg-danger-subtle disabled:opacity-50"
          >
            {cancelMutation.isPending ? "Cancelling..." : "Cancel Session"}
          </button>
        )}

        {!lobby.isCreator &&
          lobby.players.some((p) => p.role !== "CREATOR") &&
          lobby.status !== "CANCELLED" && (
            <button
              type="button"
              onClick={() => leaveMutation.mutate({ sessionId })}
              disabled={leaveMutation.isPending}
              className="rounded-lg border border-border px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-50"
            >
              {leaveMutation.isPending ? "Leaving..." : "Leave Session"}
            </button>
          )}
      </div>
    </div>
  );
}

function formatSkillRange(
  min: string | null | undefined,
  max: string | null | undefined,
): string {
  const capitalize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
  if (!min && !max) return "Any skill";
  if (min === max) return capitalize(min ?? "");
  return `${capitalize(min ?? "Any")} – ${capitalize(max ?? "Any")}`;
}
