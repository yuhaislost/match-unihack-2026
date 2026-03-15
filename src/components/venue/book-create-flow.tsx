"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "@/trpc/client";

type BookCreateFlowProps = {
  venueId: string;
  venueName: string;
  courtId: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  hourlyRate: number;
  onCancel: () => void;
};

export function BookCreateFlow({
  venueId,
  venueName,
  courtId,
  courtName,
  date,
  startTime,
  endTime,
  hourlyRate,
  onCancel,
}: BookCreateFlowProps) {
  const trpc = useTRPC();
  const [step, setStep] = useState<1 | 2>(1);
  const [gameType, setGameType] = useState<"SINGLES" | "DOUBLES">("SINGLES");
  const [skillMin, setSkillMin] = useState<string | undefined>();
  const [skillMax, setSkillMax] = useState<string | undefined>();

  const bookMutation = useMutation({
    ...trpc.booking.bookAndCreateSession.mutationOptions(),
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
  });

  const handleBook = () => {
    bookMutation.mutate({
      venueId,
      courtId,
      date,
      startTime,
      endTime,
      gameType,
      preferredSkillMin: skillMin as
        | "BEGINNER"
        | "INTERMEDIATE"
        | "ADVANCED"
        | undefined,
      preferredSkillMax: skillMax as
        | "BEGINNER"
        | "INTERMEDIATE"
        | "ADVANCED"
        | undefined,
    });
  };

  const skills = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];

  if (step === 1) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h3 className="text-sm font-semibold text-text-primary">
          Create a session
        </h3>

        {/* Game type */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-text-secondary">Game type</span>
          <div className="flex gap-2">
            {(["SINGLES", "DOUBLES"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setGameType(t)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  gameType === t
                    ? "bg-primary text-white"
                    : "border border-border text-text-secondary hover:bg-surface-3"
                }`}
              >
                {t === "SINGLES" ? "Singles (2)" : "Doubles (4)"}
              </button>
            ))}
          </div>
        </div>

        {/* Skill range (optional) */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-text-secondary">
            Skill range (optional)
          </span>
          <div className="flex gap-2">
            <select
              value={skillMin ?? ""}
              onChange={(e) => setSkillMin(e.target.value || undefined)}
              className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary"
            >
              <option value="">Min</option>
              {skills.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
            <select
              value={skillMax ?? ""}
              onChange={(e) => setSkillMax(e.target.value || undefined)}
              className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary"
            >
              <option value="">Max</option>
              {skills.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-text-primary hover:bg-surface-3"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Checkout summary
  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="text-sm font-semibold text-text-primary">
        Booking summary
      </h3>

      <div className="rounded-lg bg-surface-3/50 p-3 flex flex-col gap-1">
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Venue</span>
          <span className="text-text-primary font-medium">{venueName}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Court</span>
          <span className="text-text-primary font-medium">{courtName}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Time</span>
          <span className="text-text-primary font-medium">
            {startTime} - {endTime}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Date</span>
          <span className="text-text-primary font-medium">{date}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Game</span>
          <span className="text-text-primary font-medium">
            {gameType === "SINGLES" ? "Singles" : "Doubles"}
          </span>
        </div>
        <div className="mt-1 border-t border-border pt-1 flex justify-between text-sm font-semibold">
          <span className="text-text-primary">Total</span>
          <span className="text-text-primary">${hourlyRate.toFixed(2)}</span>
        </div>
      </div>

      <p className="text-xs text-text-tertiary">
        You&apos;ll pay the full court cost upfront. The session will appear in
        the feed once payment is confirmed.
      </p>

      {bookMutation.error && (
        <p className="text-xs text-danger">{bookMutation.error.message}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-text-primary hover:bg-surface-3"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleBook}
          disabled={bookMutation.isPending}
          className="flex-1 rounded-xl bg-success py-3 text-sm font-semibold text-white hover:bg-success-hover disabled:opacity-50"
        >
          {bookMutation.isPending
            ? "Redirecting..."
            : `Pay $${hourlyRate.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
