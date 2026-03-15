"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useTRPC } from "@/trpc/client";

type JoinRequestCardProps = {
  requestId: string;
  sessionId: string;
  requester: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    skillLevel: string | null;
    avgSportsmanshipRating: number;
  };
};

export function JoinRequestCard({
  requestId,
  sessionId,
  requester,
}: JoinRequestCardProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const lobbyQueryKey = trpc.scheduleMatch.getLobby.queryOptions({
    sessionId,
  }).queryKey;

  const respondMutation = useMutation(
    trpc.scheduleMatch.respondToJoinRequest.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: lobbyQueryKey });
      },
    }),
  );

  const handleRespond = (action: "ACCEPT" | "DECLINE") => {
    respondMutation.mutate({ requestId, action });
  };

  const skillLabel = requester.skillLevel
    ? requester.skillLevel.charAt(0) +
      requester.skillLevel.slice(1).toLowerCase()
    : "Unknown";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-1 p-3">
      {/* Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-3">
        {requester.avatarUrl ? (
          <Image
            src={requester.avatarUrl}
            alt={requester.displayName}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <span className="text-sm font-bold text-text-secondary">
            {requester.displayName.charAt(0)}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-text-primary">
          {requester.displayName}
        </p>
        <p className="text-xs text-text-tertiary">
          {skillLabel}
          {requester.avgSportsmanshipRating > 0 &&
            ` · ${requester.avgSportsmanshipRating.toFixed(1)}★`}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleRespond("DECLINE")}
          disabled={respondMutation.isPending}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={() => handleRespond("ACCEPT")}
          disabled={respondMutation.isPending}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
