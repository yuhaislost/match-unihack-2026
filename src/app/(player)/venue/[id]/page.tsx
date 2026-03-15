import { redirect } from "next/navigation";

type VenuePageProps = {
  params: Promise<{ id: string }>;
};

export default async function VenuePage({ params }: VenuePageProps) {
  const { id } = await params;
  redirect(`/explore?venue=${id}`);
}
