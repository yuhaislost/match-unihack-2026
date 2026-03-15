import { Suspense } from "react";
import { SessionLobby } from "@/components/schedule/session-lobby";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SessionLobbyPage({ params }: Props) {
  const { id } = await params;
  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(
    trpc.scheduleMatch.getLobby.queryOptions({ sessionId: id }),
  );

  return (
    <HydrateClient>
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        }
      >
        <SessionLobby sessionId={id} />
      </Suspense>
    </HydrateClient>
  );
}
