import "server-only";

import { prisma } from "@/lib/prisma";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export const SLOT_HOLD_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export type AvailableSlot = {
  courtId: string;
  courtName: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  isAvailable: boolean;
  unavailableReason?: "booked" | "held" | "closed";
};

export type SlotsByPeriod = {
  morning: AvailableSlot[];
  afternoon: AvailableSlot[];
  evening: AvailableSlot[];
};

// ─── Helpers ───

function padTime(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const aS = timeToMinutes(aStart);
  const aE = timeToMinutes(aEnd);
  const bS = timeToMinutes(bStart);
  const bE = timeToMinutes(bEnd);
  return aS < bE && bS < aE;
}

function dateToDateString(d: Date): string {
  return d.toISOString().split("T")[0];
}

// ─── Clean Expired Holds ───

export async function cleanExpiredHolds(): Promise<void> {
  try {
    await prisma.courtSlotHold.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  } catch (error) {
    console.error("[court-availability.cleanExpiredHolds]", { error });
  }
}

// ─── Get Available Slots ───

export async function getAvailableSlots({
  venueId,
  date,
}: {
  venueId: string;
  date: string;
}): Promise<ServiceResult<SlotsByPeriod>> {
  try {
    // Lazily clean expired holds
    await cleanExpiredHolds();

    const parsedDate = new Date(`${date}T00:00:00Z`);
    const dayOfWeek = parsedDate.getUTCDay();

    // Get all active courts for the venue
    const courts = await prisma.court.findMany({
      where: { venueId, isActive: true, deletedAt: null },
    });

    if (courts.length === 0) {
      return {
        success: true,
        data: { morning: [], afternoon: [], evening: [] },
      };
    }

    const courtIds = courts.map((c) => c.id);

    // Get availability records for all courts
    const availabilities = await prisma.courtAvailability.findMany({
      where: {
        courtId: { in: courtIds },
        OR: [
          { type: "RECURRING", dayOfWeek },
          { type: "ONE_OFF", specificDate: parsedDate },
        ],
      },
    });

    // Get existing sessions that overlap with this date (not cancelled/completed)
    const dayStart = new Date(`${date}T00:00:00Z`);
    const dayEnd = new Date(`${date}T23:59:59Z`);

    const sessions = await prisma.session.findMany({
      where: {
        courtId: { in: courtIds },
        status: { notIn: ["CANCELLED", "COMPLETED"] },
        scheduledStartTime: { lt: dayEnd },
        scheduledEndTime: { gt: dayStart },
      },
      select: {
        courtId: true,
        scheduledStartTime: true,
        scheduledEndTime: true,
      },
    });

    // Get active holds for this date
    const holds = await prisma.courtSlotHold.findMany({
      where: {
        courtId: { in: courtIds },
        date: parsedDate,
        expiresAt: { gt: new Date() },
      },
    });

    // Build slots for each court
    const allSlots: AvailableSlot[] = [];

    for (const court of courts) {
      const courtAvailabilities = availabilities.filter(
        (a) => a.courtId === court.id,
      );

      // Find explicit closures (ONE_OFF with isAvailable = false)
      const closures = courtAvailabilities.filter(
        (a) => a.type === "ONE_OFF" && !a.isAvailable,
      );
      const openWindows = courtAvailabilities.filter((a) => a.isAvailable);

      // Generate 1-hour slots from open availability windows
      for (const window of openWindows) {
        const startH = window.startTime.getUTCHours();
        const startM = window.startTime.getUTCMinutes();
        const endH = window.endTime.getUTCHours();
        const endM = window.endTime.getUTCMinutes();

        const windowStartMinutes = startH * 60 + startM;
        const windowEndMinutes = endH * 60 + endM;

        for (
          let slotStart = windowStartMinutes;
          slotStart + 60 <= windowEndMinutes;
          slotStart += 60
        ) {
          const slotEnd = slotStart + 60;
          const slotStartTime = padTime(
            Math.floor(slotStart / 60),
            slotStart % 60,
          );
          const slotEndTime = padTime(Math.floor(slotEnd / 60), slotEnd % 60);

          // Check if slot falls within a closure
          const isClosed = closures.some((c) => {
            const cStart = padTime(
              c.startTime.getUTCHours(),
              c.startTime.getUTCMinutes(),
            );
            const cEnd = padTime(
              c.endTime.getUTCHours(),
              c.endTime.getUTCMinutes(),
            );
            return timesOverlap(slotStartTime, slotEndTime, cStart, cEnd);
          });

          if (isClosed) {
            allSlots.push({
              courtId: court.id,
              courtName: court.name,
              startTime: slotStartTime,
              endTime: slotEndTime,
              isAvailable: false,
              unavailableReason: "closed",
            });
            continue;
          }

          // Check if slot is booked by an existing session
          const isBooked = sessions.some((s) => {
            if (s.courtId !== court.id) return false;
            if (!s.scheduledStartTime || !s.scheduledEndTime) return false;

            const sessionDate = dateToDateString(s.scheduledStartTime);
            if (sessionDate !== date) return false;

            const sessionStart = padTime(
              s.scheduledStartTime.getUTCHours(),
              s.scheduledStartTime.getUTCMinutes(),
            );
            const sessionEnd = padTime(
              s.scheduledEndTime.getUTCHours(),
              s.scheduledEndTime.getUTCMinutes(),
            );
            return timesOverlap(
              slotStartTime,
              slotEndTime,
              sessionStart,
              sessionEnd,
            );
          });

          if (isBooked) {
            allSlots.push({
              courtId: court.id,
              courtName: court.name,
              startTime: slotStartTime,
              endTime: slotEndTime,
              isAvailable: false,
              unavailableReason: "booked",
            });
            continue;
          }

          // Check if slot is held
          const isHeld = holds.some((h) => {
            if (h.courtId !== court.id) return false;
            const holdStart = padTime(
              h.startTime.getUTCHours(),
              h.startTime.getUTCMinutes(),
            );
            const holdEnd = padTime(
              h.endTime.getUTCHours(),
              h.endTime.getUTCMinutes(),
            );
            return timesOverlap(slotStartTime, slotEndTime, holdStart, holdEnd);
          });

          if (isHeld) {
            allSlots.push({
              courtId: court.id,
              courtName: court.name,
              startTime: slotStartTime,
              endTime: slotEndTime,
              isAvailable: false,
              unavailableReason: "held",
            });
            continue;
          }

          allSlots.push({
            courtId: court.id,
            courtName: court.name,
            startTime: slotStartTime,
            endTime: slotEndTime,
            isAvailable: true,
          });
        }
      }
    }

    // Group by period
    const result: SlotsByPeriod = {
      morning: allSlots.filter((s) => timeToMinutes(s.startTime) < 720),
      afternoon: allSlots.filter(
        (s) =>
          timeToMinutes(s.startTime) >= 720 &&
          timeToMinutes(s.startTime) < 1020,
      ),
      evening: allSlots.filter((s) => timeToMinutes(s.startTime) >= 1020),
    };

    return { success: true, data: result };
  } catch (error) {
    console.error("[court-availability.getAvailableSlots]", {
      venueId,
      date,
      error,
    });
    return { success: false, error: "Failed to get available slots" };
  }
}

// ─── Hold Slot ───

export async function holdSlot({
  courtId,
  date,
  startTime,
  endTime,
  heldById,
  sessionId,
}: {
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
  heldById: string;
  sessionId?: string;
}): Promise<ServiceResult<{ holdId: string; expiresAt: Date }>> {
  try {
    const parsedDate = new Date(`${date}T00:00:00Z`);
    const parsedStartTime = new Date(`1970-01-01T${startTime}:00Z`);
    const parsedEndTime = new Date(`1970-01-01T${endTime}:00Z`);

    const result = await prisma.$transaction(async (tx) => {
      // Check for existing active holds that overlap
      const existingHolds = await tx.courtSlotHold.findMany({
        where: {
          courtId,
          date: parsedDate,
          expiresAt: { gt: new Date() },
        },
      });

      const hasHoldConflict = existingHolds.some((h) => {
        const holdStart = padTime(
          h.startTime.getUTCHours(),
          h.startTime.getUTCMinutes(),
        );
        const holdEnd = padTime(
          h.endTime.getUTCHours(),
          h.endTime.getUTCMinutes(),
        );
        return timesOverlap(startTime, endTime, holdStart, holdEnd);
      });

      if (hasHoldConflict) {
        return null;
      }

      // Check for existing bookings (sessions) that overlap
      const dayStart = new Date(`${date}T00:00:00Z`);
      const dayEnd = new Date(`${date}T23:59:59Z`);

      const existingSessions = await tx.session.findMany({
        where: {
          courtId,
          status: { notIn: ["CANCELLED", "COMPLETED"] },
          scheduledStartTime: { lt: dayEnd },
          scheduledEndTime: { gt: dayStart },
        },
        select: {
          scheduledStartTime: true,
          scheduledEndTime: true,
        },
      });

      const hasBookingConflict = existingSessions.some((s) => {
        if (!s.scheduledStartTime || !s.scheduledEndTime) return false;

        const sessionDate = dateToDateString(s.scheduledStartTime);
        if (sessionDate !== date) return false;

        const sessionStart = padTime(
          s.scheduledStartTime.getUTCHours(),
          s.scheduledStartTime.getUTCMinutes(),
        );
        const sessionEnd = padTime(
          s.scheduledEndTime.getUTCHours(),
          s.scheduledEndTime.getUTCMinutes(),
        );
        return timesOverlap(startTime, endTime, sessionStart, sessionEnd);
      });

      if (hasBookingConflict) {
        return null;
      }

      const expiresAt = new Date(Date.now() + SLOT_HOLD_DURATION_MS);

      const hold = await tx.courtSlotHold.create({
        data: {
          courtId,
          date: parsedDate,
          startTime: parsedStartTime,
          endTime: parsedEndTime,
          heldById,
          sessionId: sessionId ?? null,
          expiresAt,
        },
      });

      return { holdId: hold.id, expiresAt };
    });

    if (!result) {
      return {
        success: false,
        error: "Slot is not available",
        code: "CONFLICT",
      };
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("[court-availability.holdSlot]", {
      courtId,
      date,
      startTime,
      endTime,
      error,
    });
    return { success: false, error: "Failed to hold slot" };
  }
}

// ─── Release Hold ───

export async function releaseHold(
  holdId: string,
): Promise<ServiceResult<null>> {
  try {
    await prisma.courtSlotHold.delete({
      where: { id: holdId },
    });

    return { success: true, data: null };
  } catch (error) {
    console.error("[court-availability.releaseHold]", { holdId, error });
    return { success: false, error: "Failed to release hold" };
  }
}
