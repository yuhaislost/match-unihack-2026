"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { HeroCard } from "@/components/hero-card/hero-card";
import { SuggestionList } from "@/components/hero-card/suggestion-list";
import { useHeroCard } from "@/components/hero-card/use-hero-card";
import { VenueDetailSheet } from "@/components/venue/venue-detail-sheet";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useTRPC } from "@/trpc/client";
import { BottomSheet } from "./bottom-sheet";
import { ExploreMap } from "./explore-map";
import { SessionCard } from "./session-card";
import { VenueCard } from "./venue-card";

export function ExploreContent() {
  const { state } = useHeroCard();
  const { latitude, longitude, loading: geoLoading } = useGeolocation();
  const trpc = useTRPC();
  const router = useRouter();
  const searchParams = useSearchParams();
  const venueFromUrl = searchParams.get("venue");
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(
    venueFromUrl,
  );

  // Listen for hero card "browse for session" event
  useEffect(() => {
    const handleBrowseForSession = () => {
      // Just close any open venue detail — the feed is already showing venues
      setSelectedVenueId(null);
    };
    window.addEventListener("venue:browse-for-session", handleBrowseForSession);
    return () =>
      window.removeEventListener(
        "venue:browse-for-session",
        handleBrowseForSession,
      );
  }, []);

  const showSuggestions =
    state.kind === "SEARCHING" || state.kind === "PENDING_REQUEST";

  const hasLocation = latitude !== null && longitude !== null;

  // Nearby venues
  const { data: venues } = useQuery({
    ...trpc.venue.listNearby.queryOptions({
      latitude: latitude ?? 0,
      longitude: longitude ?? 0,
      radiusKm: 10,
    }),
    enabled: hasLocation,
  });

  // Active queue players for map dots
  const { data: queuePlayers } = useQuery({
    ...trpc.matching.getQueuePlayers.queryOptions({
      latitude: latitude ?? 0,
      longitude: longitude ?? 0,
      radiusKm: 10,
    }),
    enabled: hasLocation,
    refetchInterval: 15_000,
  });

  // Open scheduled sessions nearby
  const { data: openSessions } = useQuery({
    ...trpc.session.listOpenNearby.queryOptions({
      latitude: latitude ?? 0,
      longitude: longitude ?? 0,
      radiusKm: 10,
    }),
    enabled: hasLocation,
  });

  const venueMapPins = (venues ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    latitude: v.latitude,
    longitude: v.longitude,
    avgRating: v.avgRating,
    courtCount: v.courtCount,
  }));

  const playerDots = (queuePlayers ?? []).map((p) => ({
    id: p.id,
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  const handleVenueClick = useCallback((venueId: string) => {
    setSelectedVenueId(venueId);
  }, []);

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] w-full overflow-hidden">
      {/* Full-screen map background */}
      <div className="absolute inset-0">
        {geoLoading ? (
          <div className="flex h-full w-full items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-small text-text-secondary">
                Getting your location...
              </p>
            </div>
          </div>
        ) : hasLocation ? (
          <ExploreMap
            userLatitude={latitude}
            userLongitude={longitude}
            venues={venueMapPins}
            players={playerDots}
            onVenueClick={handleVenueClick}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-background">
            <p className="px-8 text-center text-small text-text-secondary">
              Enable location access to see nearby venues and players
            </p>
          </div>
        )}
      </div>

      {/* Bottom sheet with hero card anchored above the drag handle */}
      <BottomSheet
        header={<HeroCard />}
        mode={selectedVenueId ? "venue-detail" : "feed"}
        overlayContent={
          selectedVenueId ? (
            <VenueDetailSheet
              venueId={selectedVenueId}
              onClose={() => setSelectedVenueId(null)}
            />
          ) : undefined
        }
        onBack={() => setSelectedVenueId(null)}
      >
        <div className="flex flex-col gap-2 px-4">
          {/* Player suggestions (injected when searching) */}
          {showSuggestions && (
            <div className="mb-2">
              <SuggestionList enabled={showSuggestions} />
            </div>
          )}

          {/* Open sessions feed */}
          {openSessions && openSessions.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-small-medium text-text-secondary">
                Open sessions
              </h2>
              {openSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  gameType={session.gameType}
                  scheduledStartTime={session.scheduledStartTime}
                  currentPlayerCount={session.currentPlayerCount}
                  maxPlayers={session.maxPlayers}
                  preferredSkillMin={session.preferredSkillMin}
                  preferredSkillMax={session.preferredSkillMax}
                  distance={session.distance}
                  creator={session.creator}
                  onClick={() => router.push(`/sessions/${session.id}`)}
                />
              ))}
            </div>
          )}

          {/* Venue feed */}
          <h2 className="text-small-medium text-text-secondary">
            Nearby venues
          </h2>
          {venues && venues.length > 0 ? (
            <div className="flex flex-col gap-2">
              {venues.map((venue) => (
                <VenueCard
                  key={venue.id}
                  name={venue.name}
                  address={venue.address}
                  avgRating={venue.avgRating}
                  totalReviews={venue.totalReviews}
                  distance={venue.distance}
                  courtCount={venue.courtCount}
                  minHourlyRate={venue.minHourlyRate}
                  onClick={() => handleVenueClick(venue.id)}
                />
              ))}
            </div>
          ) : hasLocation && !geoLoading ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <p className="text-small text-text-secondary">
                No venues nearby yet
              </p>
              <p className="text-caption text-text-tertiary">
                Venues will appear here as merchants list their courts
              </p>
            </div>
          ) : null}
        </div>
      </BottomSheet>
    </div>
  );
}
