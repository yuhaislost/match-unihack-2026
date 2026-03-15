import "server-only";

import { prisma } from "@/lib/prisma";
import { haversineDistance } from "@/lib/services/matching";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type NearbyVenue = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  avgRating: number;
  totalReviews: number;
  photoUrls: string[];
  distance: number;
  courtCount: number;
  minHourlyRate: number | null;
};

export async function listNearbyVenues(
  latitude: number,
  longitude: number,
  radiusKm: number,
): Promise<ServiceResult<NearbyVenue[]>> {
  try {
    const venues = await prisma.venue.findMany({
      where: { deletedAt: null },
      include: {
        courts: {
          where: { deletedAt: null, isActive: true },
          select: { id: true, hourlyRate: true },
        },
      },
    });

    const nearby: NearbyVenue[] = [];
    for (const v of venues) {
      const dist = haversineDistance(
        latitude,
        longitude,
        Number(v.latitude),
        Number(v.longitude),
      );
      if (dist > radiusKm) continue;

      const rates = v.courts.map((c) => Number(c.hourlyRate));
      nearby.push({
        id: v.id,
        name: v.name,
        address: v.address,
        latitude: Number(v.latitude),
        longitude: Number(v.longitude),
        avgRating: Number(v.avgRating),
        totalReviews: v.totalReviews,
        photoUrls: v.photoUrls,
        distance: Math.round(dist * 10) / 10,
        courtCount: v.courts.length,
        minHourlyRate: rates.length > 0 ? Math.min(...rates) : null,
      });
    }

    nearby.sort((a, b) => a.distance - b.distance);
    return { success: true, data: nearby };
  } catch (error) {
    console.error("[venue.listNearby]", {
      latitude,
      longitude,
      radiusKm,
      error,
    });
    return { success: false, error: "Failed to list nearby venues" };
  }
}

// ─── Venue Suggestions for Midpoint ───

export type VenueSuggestion = {
  venueId: string;
  courtId: string;
  venueName: string;
  address: string;
  distance: number;
  hourlyRate: number;
  photoUrl: string | null;
  avgRating: number;
  rank: number;
};

export async function suggestVenuesForMidpoint(
  playerLocations: Array<{ lat: number; lng: number }>,
  maxSuggestions: number,
): Promise<ServiceResult<VenueSuggestion[]>> {
  try {
    // Calculate geographic midpoint
    const midLat =
      playerLocations.reduce((sum, l) => sum + l.lat, 0) /
      playerLocations.length;
    const midLng =
      playerLocations.reduce((sum, l) => sum + l.lng, 0) /
      playerLocations.length;

    const venues = await prisma.venue.findMany({
      where: { deletedAt: null },
      include: {
        courts: {
          where: { deletedAt: null, isActive: true },
          select: { id: true, hourlyRate: true, name: true },
          orderBy: { hourlyRate: "asc" },
        },
      },
    });

    type ScoredVenue = {
      venue: (typeof venues)[number];
      court: (typeof venues)[number]["courts"][number];
      distance: number;
      score: number;
    };

    const scored: ScoredVenue[] = [];
    for (const v of venues) {
      if (v.courts.length === 0) continue;

      const dist = haversineDistance(
        midLat,
        midLng,
        Number(v.latitude),
        Number(v.longitude),
      );

      // Only consider venues within 20km of midpoint
      if (dist > 20) continue;

      const cheapestCourt = v.courts[0];
      const price = Number(cheapestCourt.hourlyRate);

      // Score: lower distance is better, lower price is better, higher rating is better
      const distScore = Math.max(0, 1 - dist / 20);
      const priceScore = Math.max(0, 1 - price / 100);
      const ratingScore = Number(v.avgRating) / 5;
      const score = 0.5 * distScore + 0.2 * priceScore + 0.3 * ratingScore;

      scored.push({ venue: v, court: cheapestCourt, distance: dist, score });
    }

    scored.sort((a, b) => b.score - a.score);

    const suggestions: VenueSuggestion[] = scored
      .slice(0, maxSuggestions)
      .map((s, i) => ({
        venueId: s.venue.id,
        courtId: s.court.id,
        venueName: s.venue.name,
        address: s.venue.address,
        distance: Math.round(s.distance * 10) / 10,
        hourlyRate: Number(s.court.hourlyRate),
        photoUrl: s.venue.photoUrls[0] ?? null,
        avgRating: Number(s.venue.avgRating),
        rank: i + 1,
      }));

    return { success: true, data: suggestions };
  } catch (error) {
    console.error("[venue.suggestVenuesForMidpoint]", { error });
    return { success: false, error: "Failed to suggest venues" };
  }
}

// ─── Venue Detail ───

export type VenueDetail = {
  id: string;
  name: string;
  description: string | null;
  address: string;
  latitude: number;
  longitude: number;
  avgRating: number;
  totalReviews: number;
  photoUrls: string[];
  courts: {
    id: string;
    name: string;
    capacity: number;
    hourlyRate: number;
    isActive: boolean;
  }[];
  upsellItems: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    photoUrl: string | null;
  }[];
  venueReviews: {
    id: string;
    rating: number;
    reviewText: string | null;
    createdAt: Date;
    player: {
      displayName: string;
      avatarUrl: string | null;
    };
  }[];
};

export async function getVenueById(
  venueId: string,
): Promise<ServiceResult<VenueDetail>> {
  try {
    const venue = await prisma.venue.findUnique({
      where: { id: venueId, deletedAt: null },
      include: {
        courts: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            capacity: true,
            hourlyRate: true,
            isActive: true,
          },
          orderBy: { name: "asc" },
        },
        upsellItems: {
          where: { deletedAt: null, isActive: true },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            photoUrl: true,
          },
          orderBy: { name: "asc" },
        },
        venueReviews: {
          where: { deletedAt: null },
          select: {
            id: true,
            rating: true,
            reviewText: true,
            createdAt: true,
            player: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!venue) {
      return { success: false, error: "Venue not found", code: "NOT_FOUND" };
    }

    return {
      success: true,
      data: {
        id: venue.id,
        name: venue.name,
        description: venue.description,
        address: venue.address,
        latitude: Number(venue.latitude),
        longitude: Number(venue.longitude),
        avgRating: Number(venue.avgRating),
        totalReviews: venue.totalReviews,
        photoUrls: venue.photoUrls,
        courts: venue.courts.map((c) => ({
          ...c,
          hourlyRate: Number(c.hourlyRate),
        })),
        upsellItems: venue.upsellItems.map((u) => ({
          ...u,
          price: Number(u.price),
        })),
        venueReviews: venue.venueReviews,
      },
    };
  } catch (error) {
    console.error("[venue.getById]", { venueId, error });
    return { success: false, error: "Failed to get venue" };
  }
}
