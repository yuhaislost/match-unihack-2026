"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useSuggestions(enabled: boolean) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const suggestionsQuery = useQuery({
    ...trpc.matching.getSuggestions.queryOptions(),
    enabled,
    refetchInterval: enabled ? 5000 : false,
  });

  const sendRequestMutation = useMutation({
    ...trpc.matching.sendRequest.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.matching.getQueueStatus.queryOptions().queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: trpc.matching.getSuggestions.queryOptions().queryKey,
      });
    },
  });

  return {
    candidates: suggestionsQuery.data ?? [],
    isLoading: suggestionsQuery.isLoading,
    sendRequest: (recipientId: string) => {
      sendRequestMutation.mutate({ recipientId });
    },
    isRequestPending: sendRequestMutation.isPending,
  };
}
