"use client";

import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTRPC } from "@/trpc/client";

const SKILL_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;

export function CreateSessionForm() {
  const trpc = useTRPC();
  const router = useRouter();

  const [gameType, setGameType] = useState<"SINGLES" | "DOUBLES">("SINGLES");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [skillMin, setSkillMin] = useState<string>("");
  const [skillMax, setSkillMax] = useState<string>("");
  const [autoAccept, setAutoAccept] = useState(false);

  const createMutation = useMutation(
    trpc.scheduleMatch.create.mutationOptions({
      onSuccess: (data) => {
        router.push(`/sessions/${data.sessionId}`);
      },
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!date || !startTime || !endTime) return;

    const scheduledStartTime = new Date(`${date}T${startTime}`).toISOString();
    const scheduledEndTime = new Date(`${date}T${endTime}`).toISOString();

    createMutation.mutate({
      gameType,
      scheduledStartTime,
      scheduledEndTime,
      preferredSkillMin: skillMin
        ? (skillMin as (typeof SKILL_LEVELS)[number])
        : undefined,
      preferredSkillMax: skillMax
        ? (skillMax as (typeof SKILL_LEVELS)[number])
        : undefined,
      autoAccept,
    });
  };

  const tomorrow = format(
    new Date(Date.now() + 24 * 60 * 60 * 1000),
    "yyyy-MM-dd",
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Game Type */}
      <div className="flex flex-col gap-2">
        <span className="text-small-medium text-text-secondary">Game Type</span>
        <div className="flex gap-2">
          {(["SINGLES", "DOUBLES"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setGameType(type)}
              className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                gameType === type
                  ? "border-primary bg-primary-subtle text-primary"
                  : "border-border bg-surface-1 text-text-secondary"
              }`}
            >
              {type === "SINGLES" ? "Singles" : "Doubles"}
            </button>
          ))}
        </div>
      </div>

      {/* Date */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="session-date"
          className="text-small-medium text-text-secondary"
        >
          Date
        </label>
        <input
          id="session-date"
          type="date"
          min={tomorrow}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm text-text-primary outline-none focus:border-primary"
        />
      </div>

      {/* Time Range */}
      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <label
            htmlFor="start-time"
            className="text-small-medium text-text-secondary"
          >
            Start Time
          </label>
          <input
            id="start-time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
            className="rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm text-text-primary outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label
            htmlFor="end-time"
            className="text-small-medium text-text-secondary"
          >
            End Time
          </label>
          <input
            id="end-time"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
            className="rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm text-text-primary outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Skill Range */}
      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <label
            htmlFor="skill-min"
            className="text-small-medium text-text-secondary"
          >
            Min Skill
          </label>
          <select
            id="skill-min"
            value={skillMin}
            onChange={(e) => setSkillMin(e.target.value)}
            className="rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm text-text-primary outline-none focus:border-primary"
          >
            <option value="">Any</option>
            {SKILL_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level.charAt(0) + level.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label
            htmlFor="skill-max"
            className="text-small-medium text-text-secondary"
          >
            Max Skill
          </label>
          <select
            id="skill-max"
            value={skillMax}
            onChange={(e) => setSkillMax(e.target.value)}
            className="rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm text-text-primary outline-none focus:border-primary"
          >
            <option value="">Any</option>
            {SKILL_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level.charAt(0) + level.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Auto Accept */}
      <label className="flex items-center gap-3 rounded-lg border border-border bg-surface-1 px-4 py-3">
        <input
          type="checkbox"
          checked={autoAccept}
          onChange={(e) => setAutoAccept(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <div>
          <p className="text-sm font-medium text-text-primary">Auto-accept</p>
          <p className="text-xs text-text-tertiary">
            Players join automatically without your approval
          </p>
        </div>
      </label>

      {/* Submit */}
      <button
        type="submit"
        disabled={createMutation.isPending || !date || !startTime || !endTime}
        className="rounded-lg bg-primary px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {createMutation.isPending ? "Creating..." : "Create Session"}
      </button>

      {createMutation.isError && (
        <p className="text-center text-xs text-danger">
          {createMutation.error.message}
        </p>
      )}
    </form>
  );
}
