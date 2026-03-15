import { SessionsList } from "@/components/schedule/sessions-list";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export default async function SessionsPage() {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    trpc.session.listByPlayer.queryOptions({ limit: 20 }),
  );

  return (
    <HydrateClient>
      <SessionsList />
    </HydrateClient>
  );
}
