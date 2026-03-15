"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import Image from "next/image";
import { useState } from "react";
import { useTRPC } from "@/trpc/client";
import { AttachSessionPicker } from "./attach-session-picker";
import { BookCreateFlow } from "./book-create-flow";
import { DatePickerStrip } from "./date-picker-strip";
import { TimeSlotList } from "./time-slot-list";

type VenueDetailSheetProps = {
  venueId: string;
  onClose: () => void;
};

type ActionFlow = "none" | "book-create" | "attach-session";

export function VenueDetailSheet({ venueId, onClose }: VenueDetailSheetProps) {
  const trpc = useTRPC();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState<{
    courtId: string;
    courtName: string;
    startTime: string;
    endTime: string;
  } | null>(null);
  const [actionFlow, setActionFlow] = useState<ActionFlow>("none");

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const { data: venue } = useQuery(
    trpc.venue.getById.queryOptions({ venueId }),
  );

  const { data: slots } = useQuery({
    ...trpc.venue.getAvailableSlots.queryOptions({
      venueId,
      date: dateStr,
    }),
    enabled: !!venue,
  });

  // Check if player has eligible sessions
  const { data: eligibleSessions } = useQuery(
    trpc.session.listEligibleForVenueAttach.queryOptions(),
  );

  const hasEligibleSessions = eligibleSessions && eligibleSessions.length > 0;

  if (!venue) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Find the hourly rate for the selected court
  const selectedCourt = selectedSlot
    ? venue.courts.find((c) => c.id === selectedSlot.courtId)
    : null;

  // If in a sub-flow, render that
  if (actionFlow === "book-create" && selectedSlot && selectedCourt) {
    return (
      <BookCreateFlow
        venueId={venueId}
        venueName={venue.name}
        courtId={selectedSlot.courtId}
        courtName={selectedSlot.courtName}
        date={dateStr}
        startTime={selectedSlot.startTime}
        endTime={selectedSlot.endTime}
        hourlyRate={selectedCourt.hourlyRate}
        onCancel={() => setActionFlow("none")}
      />
    );
  }

  if (actionFlow === "attach-session" && selectedSlot) {
    return (
      <AttachSessionPicker
        venueId={venueId}
        courtId={selectedSlot.courtId}
        date={dateStr}
        startTime={selectedSlot.startTime}
        endTime={selectedSlot.endTime}
        onCancel={() => setActionFlow("none")}
        onSuccess={onClose}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      {/* Venue header */}
      <div className="flex items-start gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-surface-3 overflow-hidden">
          {venue.photoUrls[0] ? (
            <Image
              src={venue.photoUrls[0]}
              alt={venue.name}
              width={64}
              height={64}
              className="h-16 w-16 object-cover"
            />
          ) : (
            <svg
              className="h-8 w-8 text-text-tertiary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008V7.5z"
              />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-text-primary truncate">
            {venue.name}
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">{venue.address}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-text-secondary">
            {venue.avgRating > 0 && (
              <span>{venue.avgRating.toFixed(1)} stars</span>
            )}
            {venue.totalReviews > 0 && (
              <>
                <span>&middot;</span>
                <span>{venue.totalReviews} reviews</span>
              </>
            )}
            <span>&middot;</span>
            <span>
              {venue.courts.length} court{venue.courts.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Date picker */}
      <DatePickerStrip
        selectedDate={selectedDate}
        onDateSelect={(d) => {
          setSelectedDate(d);
          setSelectedSlot(null);
        }}
      />

      {/* Time slots */}
      {slots ? (
        <TimeSlotList
          slots={slots}
          selectedSlot={selectedSlot}
          onSlotSelect={setSelectedSlot}
        />
      ) : (
        <div className="flex items-center justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {/* Action buttons (sticky at bottom) */}
      {selectedSlot && (
        <div className="flex flex-col gap-2 pt-2 border-t border-border">
          <p className="text-xs text-text-secondary">
            {selectedSlot.courtName} &middot; {selectedSlot.startTime} -{" "}
            {selectedSlot.endTime}
            {selectedCourt && ` · $${selectedCourt.hourlyRate}/hr`}
          </p>
          <button
            type="button"
            onClick={() => setActionFlow("book-create")}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Book + create session
          </button>
          <button
            type="button"
            onClick={() => setActionFlow("attach-session")}
            disabled={!hasEligibleSessions}
            className="w-full rounded-xl border border-border py-3 text-sm font-medium text-text-primary transition-colors hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Attach to session
          </button>
        </div>
      )}
    </div>
  );
}
