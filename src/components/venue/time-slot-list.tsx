"use client";

type AvailableSlot = {
  courtId: string;
  courtName: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  unavailableReason?: "booked" | "held" | "closed";
};

type SlotsByPeriod = {
  morning: AvailableSlot[];
  afternoon: AvailableSlot[];
  evening: AvailableSlot[];
};

type TimeSlotListProps = {
  slots: SlotsByPeriod;
  selectedSlot: { courtId: string; startTime: string; endTime: string } | null;
  onSlotSelect: (slot: {
    courtId: string;
    courtName: string;
    startTime: string;
    endTime: string;
  }) => void;
};

function SlotGroup({
  label,
  slots,
  selectedSlot,
  onSlotSelect,
}: {
  label: string;
  slots: AvailableSlot[];
  selectedSlot: TimeSlotListProps["selectedSlot"];
  onSlotSelect: TimeSlotListProps["onSlotSelect"];
}) {
  if (slots.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide">
        {label}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {slots.map((slot) => {
          const isSelected =
            selectedSlot?.courtId === slot.courtId &&
            selectedSlot?.startTime === slot.startTime;

          return (
            <button
              key={`${slot.courtId}-${slot.startTime}`}
              type="button"
              onClick={() =>
                slot.isAvailable
                  ? onSlotSelect({
                      courtId: slot.courtId,
                      courtName: slot.courtName,
                      startTime: slot.startTime,
                      endTime: slot.endTime,
                    })
                  : undefined
              }
              disabled={!slot.isAvailable}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                !slot.isAvailable
                  ? "bg-surface-3/50 text-text-tertiary line-through cursor-not-allowed"
                  : isSelected
                    ? "bg-primary text-white"
                    : "bg-surface-3 text-text-primary hover:bg-surface-3/80"
              }`}
            >
              <span>{slot.startTime}</span>
              {slot.courtName && (
                <span className="block text-[10px] opacity-70">
                  {slot.courtName}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TimeSlotList({
  slots,
  selectedSlot,
  onSlotSelect,
}: TimeSlotListProps) {
  const totalSlots =
    slots.morning.length + slots.afternoon.length + slots.evening.length;

  if (totalSlots === 0) {
    return (
      <p className="text-sm text-text-secondary text-center py-4">
        No slots available for this date
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SlotGroup
        label="Morning"
        slots={slots.morning}
        selectedSlot={selectedSlot}
        onSlotSelect={onSlotSelect}
      />
      <SlotGroup
        label="Afternoon"
        slots={slots.afternoon}
        selectedSlot={selectedSlot}
        onSlotSelect={onSlotSelect}
      />
      <SlotGroup
        label="Evening"
        slots={slots.evening}
        selectedSlot={selectedSlot}
        onSlotSelect={onSlotSelect}
      />
    </div>
  );
}
