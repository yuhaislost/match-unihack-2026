"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";
import { useTRPC } from "@/trpc/client";

/**
 * Subscribes to Supabase Realtime for instant match notifications.
 * Listens for changes to match_requests and sessions involving the player,
 * then invalidates the getQueueStatus query for an instant UI update.
 *
 * Falls back gracefully — the 3s polling in useHeroCard still works without this.
 */
export function useQueueSubscription(playerId: string | null) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!playerId) return;

    const supabase = createBrowserClient();
    const statusQueryKey = trpc.matching.getQueueStatus.queryOptions().queryKey;

    // Single channel listening to match_requests changes for this player
    const channel = supabase
      .channel(`queue:${playerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_requests",
          filter: `requester_id=eq.${playerId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: statusQueryKey });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_requests",
          filter: `recipient_id=eq.${playerId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: statusQueryKey });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "session_players",
          filter: `player_id=eq.${playerId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: statusQueryKey });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [playerId, queryClient, trpc]);
}
