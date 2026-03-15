"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useQueueSubscription } from "@/hooks/use-queue-subscription";
import { useTRPC } from "@/trpc/client";
import type { HeroCardState } from "./types";

export function useHeroCard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { latitude, longitude } = useGeolocation();

  // Subscribe to Supabase Realtime for instant match notifications
  useQueueSubscription(user?.id ?? null);

  const [localState, setLocalState] = useState<
    "CONFIGURE" | "SEARCHING" | null
  >(null);
  const [gameType, setGameType] = useState<"SINGLES" | "DOUBLES">("SINGLES");
  const [collapsed, setCollapsed] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pending expand action — stores what to do when bottom sheet signals ready
  const pendingExpandAction = useRef<"uncollapse" | "configure" | null>(null);

  // Listen for bottom sheet "ready" signal to actually expand
  useEffect(() => {
    const handleDoExpand = () => {
      const action = pendingExpandAction.current;
      pendingExpandAction.current = null;
      if (action === "uncollapse") {
        setCollapsed(false);
      } else if (action === "configure") {
        setCollapsed(false);
        setLocalState("CONFIGURE");
      }
    };
    window.addEventListener("herocard:do-expand", handleDoExpand);
    return () =>
      window.removeEventListener("herocard:do-expand", handleDoExpand);
  }, []);

  // Listen for external collapse events (from BottomSheet drag, map interaction)
  useEffect(() => {
    const handleCollapse = () => setCollapsed(true);
    window.addEventListener("herocard:collapse", handleCollapse);
    return () =>
      window.removeEventListener("herocard:collapse", handleCollapse);
  }, []);

  const statusQuery = useQuery({
    ...trpc.matching.getQueueStatus.queryOptions(),
    refetchInterval: localState === "CONFIGURE" ? false : 3000,
  });

  const enqueueMutation = useMutation({
    ...trpc.matching.enqueue.mutationOptions(),
    onSuccess: () => {
      // Don't clear localState here — keep optimistic SEARCHING until server confirms.
      // The reactive effect below will clear it once serverData is non-IDLE.
      queryClient.invalidateQueries({
        queryKey: trpc.matching.getQueueStatus.queryOptions().queryKey,
      });
    },
    onError: (err) => {
      // Revert to CONFIGURE on failure and surface the error
      setLocalState("CONFIGURE");
      setError(err.message || "Failed to find a match");
    },
  });

  const dequeueMutation = useMutation({
    ...trpc.matching.dequeue.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.matching.getQueueStatus.queryOptions().queryKey,
      });
    },
  });

  const respondMutation = useMutation({
    ...trpc.matching.respondToRequest.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.matching.getQueueStatus.queryOptions().queryKey,
      });
    },
  });

  const cancelRequestMutation = useMutation({
    ...trpc.matching.cancelRequest.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.matching.getQueueStatus.queryOptions().queryKey,
      });
    },
  });

  const voteOnProposalMutation = useMutation({
    ...trpc.session.voteOnProposal.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.matching.getQueueStatus.queryOptions().queryKey,
      });
    },
  });

  const initiateCheckoutMutation = useMutation({
    ...trpc.booking.initiateCheckout.mutationOptions(),
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
  });

  // Clear optimistic local state once server confirms a non-IDLE state
  const serverData = statusQuery.data;
  useEffect(() => {
    if (
      localState === "SEARCHING" &&
      serverData &&
      serverData.state !== "IDLE"
    ) {
      setLocalState(null);
    }
  }, [localState, serverData]);

  // Auto-expand the card when a match-critical state transition occurs
  const prevStateRef = useRef<string | null>(null);
  useEffect(() => {
    const currentState = serverData?.state;
    if (!currentState) return;
    const prev = prevStateRef.current;
    prevStateRef.current = currentState;

    // Expand when transitioning TO confirming, matched, venue selection, or booked states
    if (
      prev !== currentState &&
      (currentState === "CONFIRMING" ||
        currentState === "MATCHED" ||
        currentState === "VENUE_SELECTION" ||
        currentState === "BOOKED")
    ) {
      setCollapsed(false);
    }
  }, [serverData?.state]);

  let state: HeroCardState;

  if (localState === "CONFIGURE") {
    state = { kind: "CONFIGURE" };
  } else if (localState === "SEARCHING") {
    // Optimistic searching state before server confirms
    state = {
      kind: "SEARCHING",
      queueEntryId: "",
      timeRemainingMs: 0,
      nearbyPlayerCount:
        serverData && "nearbyPlayerCount" in serverData
          ? (serverData.nearbyPlayerCount as number)
          : 0,
    };
  } else if (!serverData || serverData.state === "IDLE") {
    state = {
      kind: "IDLE",
      nearbyPlayerCount: serverData?.nearbyPlayerCount ?? 0,
    };
  } else if (serverData.state === "SEARCHING") {
    state = {
      kind: "SEARCHING",
      queueEntryId: serverData.queueEntry.id,
      timeRemainingMs: serverData.timeRemainingMs,
      nearbyPlayerCount: serverData.nearbyPlayerCount,
    };
  } else if (serverData.state === "PENDING_REQUEST") {
    state = {
      kind: "PENDING_REQUEST",
      requestId: serverData.outgoingRequest.id,
      otherPlayer: serverData.otherPlayer,
      timeRemainingMs: serverData.timeRemainingMs,
    };
  } else if (serverData.state === "CONFIRMING") {
    state = {
      kind: "CONFIRMING",
      requestId: serverData.request.id,
      otherPlayer: serverData.otherPlayer,
      timeRemainingMs: serverData.timeRemainingMs,
      myResponse: serverData.myResponse,
      sessionId: serverData.sessionId ?? null,
    };
  } else if (serverData.state === "VENUE_SELECTION") {
    state = {
      kind: "VENUE_SELECTION",
      sessionId: serverData.session.id,
      players: serverData.session.players,
      proposals: serverData.proposals,
      pendingProposal: serverData.pendingProposal ?? null,
      timeRemainingMs: serverData.timeRemainingMs,
    };
  } else if (serverData.state === "BOOKED") {
    state = {
      kind: "BOOKED",
      sessionId: serverData.session.id,
      players: serverData.session.players,
      venue: serverData.venue,
      booking: serverData.booking,
    };
  } else if (serverData.state === "MATCHED") {
    state = {
      kind: "MATCHED",
      sessionId: serverData.session.id,
      players: serverData.session.players,
    };
  } else {
    state = { kind: "IDLE", nearbyPlayerCount: 0 };
  }

  // Countdown timer — synced from server timeRemainingMs
  const timeRemainingMs =
    state.kind === "SEARCHING" ||
    state.kind === "PENDING_REQUEST" ||
    state.kind === "CONFIRMING" ||
    state.kind === "VENUE_SELECTION"
      ? state.timeRemainingMs
      : 0;

  useEffect(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (timeRemainingMs > 0) {
      setCountdown(timeRemainingMs);
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          const next = Math.max(0, prev - 1000);
          // When countdown expires, trigger a refetch so the server can clean up
          if (next === 0) {
            queryClient.invalidateQueries({
              queryKey: trpc.matching.getQueueStatus.queryOptions().queryKey,
            });
          }
          return next;
        });
      }, 1000);
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [timeRemainingMs, queryClient, trpc]);

  // Actions
  const expand = useCallback(() => {
    setCollapsed(false);
  }, []);

  const tapCard = useCallback(() => {
    // IDLE → CONFIGURE takes priority (IDLE is always shown even if internally collapsed)
    if (state.kind === "IDLE") {
      pendingExpandAction.current = "configure";
      window.dispatchEvent(new CustomEvent("herocard:expand"));
      return;
    }
    if (collapsed) {
      pendingExpandAction.current = "uncollapse";
      window.dispatchEvent(new CustomEvent("herocard:expand"));
    }
  }, [state.kind, collapsed]);

  const findMatch = useCallback(() => {
    if (latitude === null || longitude === null) {
      setError("Enable location access to find a match");
      return;
    }
    setError(null);
    setLocalState("SEARCHING");
    enqueueMutation.mutate({ gameType, latitude, longitude });
  }, [enqueueMutation, gameType, latitude, longitude]);

  const cancel = useCallback(() => {
    if (state.kind === "SEARCHING") {
      dequeueMutation.mutate();
    } else if (state.kind === "CONFIGURE") {
      setLocalState(null);
    }
  }, [state.kind, dequeueMutation]);

  const accept = useCallback(
    (requestId: string) => {
      respondMutation.mutate({ requestId, action: "ACCEPT" });
    },
    [respondMutation],
  );

  const decline = useCallback(
    (requestId: string) => {
      respondMutation.mutate({ requestId, action: "DECLINE" });
    },
    [respondMutation],
  );

  const cancelRequest = useCallback(
    (requestId: string) => {
      cancelRequestMutation.mutate({ requestId });
    },
    [cancelRequestMutation],
  );

  const confirmVenue = useCallback(
    (proposalId: string) => {
      voteOnProposalMutation.mutate({ proposalId, vote: "CONFIRM" });
    },
    [voteOnProposalMutation],
  );

  const rejectVenue = useCallback(
    (proposalId: string) => {
      voteOnProposalMutation.mutate({ proposalId, vote: "REJECT" });
    },
    [voteOnProposalMutation],
  );

  const browseVenues = useCallback((sessionId: string) => {
    window.dispatchEvent(
      new CustomEvent("venue:browse-for-session", {
        detail: { sessionId },
      }),
    );
  }, []);

  const payNow = useCallback(
    (sessionId: string) => {
      initiateCheckoutMutation.mutate({ sessionId });
    },
    [initiateCheckoutMutation],
  );

  return {
    state,
    countdown,
    gameType,
    error,
    collapsed: collapsed && state.kind !== "IDLE",
    isLoading: statusQuery.isLoading,
    actions: {
      tapCard,
      expand,
      findMatch,
      cancel,
      accept,
      decline,
      cancelRequest,
      setGameType,
      confirmVenue,
      rejectVenue,
      browseVenues,
      payNow,
    },
    isMutating:
      enqueueMutation.isPending ||
      dequeueMutation.isPending ||
      respondMutation.isPending ||
      cancelRequestMutation.isPending ||
      voteOnProposalMutation.isPending ||
      initiateCheckoutMutation.isPending,
  };
}
