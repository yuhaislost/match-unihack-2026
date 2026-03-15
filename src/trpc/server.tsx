import "server-only"; // <-- ensure this file cannot be imported from the client
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { headers } from "next/headers";
import { cache } from "react";
import { createTRPCContext } from "./init";
import { makeQueryClient } from "./query-client";
import { appRouter } from "./routers/_app";

// IMPORTANT: Create a stable getter for the query client that
//            will return the same client during the same request.
export const getQueryClient = cache(makeQueryClient);

export const trpc = createTRPCOptionsProxy({
  ctx: async () =>
    createTRPCContext({
      headers: await headers(),
    }),
  router: appRouter,
  queryClient: getQueryClient,
});

/**
 * Wraps children with React Query's HydrationBoundary, automatically
 * dehydrating the current request's QueryClient so prefetched data
 * is available to client components.
 */
export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}

/**
 * Non-blocking prefetch helper. Fires off a prefetch without awaiting it,
 * enabling the "render as you fetch" streaming pattern.
 */
export function prefetch(queryOptions: {
  queryKey: readonly unknown[];
  queryFn: (...args: unknown[]) => Promise<unknown>;
}) {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(queryOptions);
}
