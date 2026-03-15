"use client";

import { useCallback, useMemo, useRef } from "react";
import type { MapRef } from "react-map-gl/mapbox";
import MapGL, { Marker, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";

// Custom dark style that complements the app's design system
const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";

type VenuePin = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  avgRating: number;
  courtCount: number;
};

type PlayerDot = {
  id: string;
  latitude: number;
  longitude: number;
};

type ExploreMapProps = {
  userLatitude: number;
  userLongitude: number;
  venues?: VenuePin[];
  players?: PlayerDot[];
  onVenueClick?: (venueId: string) => void;
};

export function ExploreMap({
  userLatitude,
  userLongitude,
  venues = [],
  players = [],
  onVenueClick,
}: ExploreMapProps) {
  const mapRef = useRef<MapRef>(null);

  const initialViewState = useMemo(
    () => ({
      latitude: userLatitude,
      longitude: userLongitude,
      zoom: 13,
    }),
    [userLatitude, userLongitude],
  );

  const handleVenueClick = useCallback(
    (venueId: string) => {
      onVenueClick?.(venueId);
    },
    [onVenueClick],
  );

  const handleMapInteraction = useCallback(() => {
    window.dispatchEvent(new CustomEvent("herocard:collapse"));
  }, []);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <p className="text-small text-text-secondary">
          Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to enable the map
        </p>
      </div>
    );
  }

  return (
    <MapGL
      ref={mapRef}
      initialViewState={initialViewState}
      style={{ width: "100%", height: "100%" }}
      mapStyle={MAP_STYLE}
      mapboxAccessToken={MAPBOX_TOKEN}
      attributionControl={false}
      logoPosition="bottom-right"
      maxZoom={18}
      minZoom={9}
      onDragStart={handleMapInteraction}
      onZoomStart={handleMapInteraction}
    >
      <NavigationControl position="top-right" showCompass={false} />

      {/* User location dot */}
      <Marker latitude={userLatitude} longitude={userLongitude} anchor="center">
        <div className="relative flex items-center justify-center">
          <div className="h-4 w-4 rounded-full border-2 border-white bg-primary shadow-md" />
          <div className="absolute h-8 w-8 animate-ping rounded-full bg-primary/20" />
        </div>
      </Marker>

      {/* Venue pins */}
      {venues.map((venue) => (
        <Marker
          key={venue.id}
          latitude={venue.latitude}
          longitude={venue.longitude}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            handleVenueClick(venue.id);
          }}
        >
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary shadow-md transition-transform hover:scale-110"
            aria-label={`Venue: ${venue.name}`}
          >
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </Marker>
      ))}

      {/* Active player dots */}
      {players.map((player) => (
        <Marker
          key={player.id}
          latitude={player.latitude}
          longitude={player.longitude}
          anchor="center"
        >
          <div className="h-3 w-3 rounded-full border border-white/30 bg-ace-cyan shadow-sm" />
        </Marker>
      ))}
    </MapGL>
  );
}
