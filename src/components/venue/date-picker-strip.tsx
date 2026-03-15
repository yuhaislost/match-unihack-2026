"use client";

import { addDays, format, isSameDay, isToday } from "date-fns";

type DatePickerStripProps = {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
};

export function DatePickerStrip({
  selectedDate,
  onDateSelect,
}: DatePickerStripProps) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));

  return (
    <div className="flex gap-2 overflow-x-auto hide-scrollbar py-1 px-1">
      {days.map((day) => {
        const selected = isSameDay(day, selectedDate);
        const today = isToday(day);
        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onDateSelect(day)}
            className={`flex shrink-0 flex-col items-center rounded-xl px-3 py-2 text-center transition-colors ${
              selected
                ? "bg-primary text-white"
                : "bg-surface-3 text-text-secondary hover:bg-surface-3/80"
            }`}
          >
            <span className="text-[10px] font-medium uppercase">
              {today ? "Today" : format(day, "EEE")}
            </span>
            <span className="text-sm font-bold">{format(day, "d")}</span>
            <span className="text-[10px]">{format(day, "MMM")}</span>
          </button>
        );
      })}
    </div>
  );
}
