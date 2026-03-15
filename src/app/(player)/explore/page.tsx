import { ExploreContent } from "@/components/explore/explore-content";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export default async function ExplorePage() {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(trpc.matching.getQueueStatus.queryOptions());

  return (
    <HydrateClient>
      <ExploreContent />
    </HydrateClient>
  );
}
