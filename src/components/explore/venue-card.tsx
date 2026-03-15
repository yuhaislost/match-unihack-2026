"use client";

type VenueCardProps = {
  name: string;
  address: string;
  avgRating: number;
  totalReviews: number;
  distance: number;
  courtCount: number;
  minHourlyRate: number | null;
  onClick?: () => void;
};

export function VenueCard({
  name,
  address,
  avgRating,
  totalReviews,
  distance,
  courtCount,
  minHourlyRate,
  onClick,
}: VenueCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full gap-3 rounded-lg border border-border-subtle bg-surface-1 p-3 text-left transition-colors hover:bg-surface-2 animate-feed-enter"
    >
      {/* Venue icon placeholder */}
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-subtle">
        <svg
          className="h-5 w-5 text-primary"
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
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="truncate text-sm font-semibold text-text-primary">
          {name}
        </h3>
        <p className="mt-0.5 truncate text-xs text-text-secondary">{address}</p>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-text-tertiary">
          <span className="text-mono">{distance}km</span>
          <span>&middot;</span>
          {avgRating > 0 ? (
            <>
              <span className="text-ace-gold">
                {"★".repeat(Math.round(avgRating))}
              </span>
              <span>({totalReviews})</span>
            </>
          ) : (
            <span>No reviews</span>
          )}
          <span>&middot;</span>
          <span>
            {courtCount} court{courtCount !== 1 ? "s" : ""}
          </span>
          {minHourlyRate !== null && (
            <>
              <span>&middot;</span>
              <span>From ${minHourlyRate}/hr</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}
