"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";
import { useTRPC } from "@/trpc/client";

/**
 * Subscribes to Supabase Realtime for session lobby updates.
 * Listens for changes to session_players and match_requests for the given session,
 * then invalidates the getLobby query for an instant UI update.
 */
export function useSessionSubscription(sessionId: string | null) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const supabase = createBrowserClient();
    const lobbyQueryKey = trpc.scheduleMatch.getLobby.queryOptions({
      sessionId,
    }).queryKey;

    const channel = supabase
      .channel(`session:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_players",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: lobbyQueryKey });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_requests",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: lobbyQueryKey });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: lobbyQueryKey });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId, queryClient, trpc]);
}
