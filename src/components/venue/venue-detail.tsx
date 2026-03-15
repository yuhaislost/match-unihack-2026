"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useTRPC } from "@/trpc/client";

export function VenueDetail({ venueId }: { venueId: string }) {
  const trpc = useTRPC();
  const { data: venue } = useSuspenseQuery(
    trpc.venue.getById.queryOptions({ venueId }),
  );

  return (
    <div className="flex flex-col gap-6 p-4 pb-20">
      {/* Back button */}
      <Link
        href="/explore"
        className="flex items-center gap-1.5 text-small text-text-secondary hover:text-text-primary transition-colors"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to explore
      </Link>

      {/* Photos */}
      {venue.photoUrls.length > 0 && (
        <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4">
          {venue.photoUrls.map((url, i) => (
            <Image
              key={url}
              src={url}
              alt={`${venue.name} photo ${i + 1}`}
              width={280}
              height={180}
              className="h-44 w-70 shrink-0 rounded-lg object-cover"
            />
          ))}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-title-lg text-text-primary">{venue.name}</h1>
        <p className="mt-1 text-small text-text-secondary">{venue.address}</p>
        {venue.avgRating > 0 && (
          <div className="mt-2 flex items-center gap-2 text-small">
            <span className="text-ace-gold">
              {"★".repeat(Math.round(venue.avgRating))}
              {"☆".repeat(5 - Math.round(venue.avgRating))}
            </span>
            <span className="text-text-secondary">
              {venue.avgRating.toFixed(1)} ({venue.totalReviews} review
              {venue.totalReviews !== 1 ? "s" : ""})
            </span>
          </div>
        )}
      </div>

      {/* Description */}
      {venue.description && (
        <div>
          <h2 className="text-body-medium text-text-primary">About</h2>
          <p className="mt-1 text-small text-text-secondary">
            {venue.description}
          </p>
        </div>
      )}

      {/* Courts */}
      <div>
        <h2 className="text-body-medium text-text-primary">
          Courts ({venue.courts.length})
        </h2>
        <div className="mt-2 flex flex-col gap-2">
          {venue.courts.map((court) => (
            <div
              key={court.id}
              className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-1 p-3"
            >
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {court.name}
                </p>
                <p className="text-xs text-text-tertiary">
                  Up to {court.capacity} players
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-text-primary">
                  ${court.hourlyRate}/hr
                </p>
                {!court.isActive && (
                  <p className="text-xs text-danger">Unavailable</p>
                )}
              </div>
            </div>
          ))}
          {venue.courts.length === 0 && (
            <p className="text-small text-text-tertiary">
              No courts listed yet
            </p>
          )}
        </div>
      </div>

      {/* Upsell items */}
      {venue.upsellItems.length > 0 && (
        <div>
          <h2 className="text-body-medium text-text-primary">Add-ons</h2>
          <div className="mt-2 flex flex-col gap-2">
            {venue.upsellItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-1 p-3"
              >
                {item.photoUrl ? (
                  <Image
                    src={item.photoUrl}
                    alt={item.name}
                    width={40}
                    height={40}
                    className="h-10 w-10 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-3">
                    <svg
                      className="h-4 w-4 text-text-tertiary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                      />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {item.name}
                  </p>
                  {item.description && (
                    <p className="truncate text-xs text-text-tertiary">
                      {item.description}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-semibold text-text-primary">
                  ${item.price}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      <div>
        <h2 className="text-body-medium text-text-primary">
          Reviews{venue.totalReviews > 0 ? ` (${venue.totalReviews})` : ""}
        </h2>
        <div className="mt-2 flex flex-col gap-3">
          {venue.venueReviews.length > 0 ? (
            venue.venueReviews.map((review) => (
              <div
                key={review.id}
                className="rounded-lg border border-border-subtle bg-surface-1 p-3"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3">
                    {review.player.avatarUrl ? (
                      <Image
                        src={review.player.avatarUrl}
                        alt={review.player.displayName}
                        width={28}
                        height={28}
                        className="h-7 w-7 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-bold text-text-secondary">
                        {review.player.displayName.charAt(0)}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-text-primary">
                    {review.player.displayName}
                  </span>
                  <span className="text-ace-gold text-xs">
                    {"★".repeat(review.rating)}
                    {"☆".repeat(5 - review.rating)}
                  </span>
                </div>
                {review.reviewText && (
                  <p className="mt-2 text-small text-text-secondary">
                    {review.reviewText}
                  </p>
                )}
              </div>
            ))
          ) : (
            <p className="text-small text-text-tertiary">No reviews yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
