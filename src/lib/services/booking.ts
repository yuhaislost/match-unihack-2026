import "server-only";

import { prisma } from "@/lib/prisma";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

// ─── Constants ───

export const VENUE_SELECTION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
export const DEFAULT_COMMISSION_RATE = 0.15;
export const MAX_VENUE_SUGGESTIONS = 3;

// ─── Commission ───

export async function getCommissionRate(): Promise<number> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: "commission_rate" },
    });
    if (config && config.dataType === "FLOAT") {
      const rate = Number.parseFloat(config.value);
      if (!Number.isNaN(rate) && rate >= 0 && rate <= 1) return rate;
    }
    return DEFAULT_COMMISSION_RATE;
  } catch {
    return DEFAULT_COMMISSION_RATE;
  }
}

// ─── Booking CRUD ───

export async function createBookingRecord(params: {
  sessionId: string;
  venueId: string;
  courtId: string;
  startTime: Date;
  endTime: Date;
  playerIds: string[];
  courtHourlyRate: number;
}): Promise<ServiceResult<{ bookingId: string }>> {
  try {
    const hours =
      (params.endTime.getTime() - params.startTime.getTime()) / 3_600_000;
    const totalCourtCost = params.courtHourlyRate * Math.max(hours, 1);
    const commissionRate = await getCommissionRate();
    const commissionAmount = totalCourtCost * commissionRate;
    const merchantPayoutAmount = totalCourtCost - commissionAmount;
    const playerCount = params.playerIds.length;
    const courtSharePerPlayer = totalCourtCost / playerCount;

    const booking = await prisma.booking.create({
      data: {
        sessionId: params.sessionId,
        venueId: params.venueId,
        courtId: params.courtId,
        startTime: params.startTime,
        endTime: params.endTime,
        totalCourtCost,
        totalUpsellCost: 0,
        totalAmount: totalCourtCost,
        commissionRate,
        commissionAmount,
        merchantPayoutAmount,
        status: "PENDING",
        playerShares: {
          createMany: {
            data: params.playerIds.map((playerId) => ({
              playerId,
              courtShareAmount: courtSharePerPlayer,
              upsellTotal: 0,
              totalAmount: courtSharePerPlayer,
              status: "PENDING",
            })),
          },
        },
      },
    });

    return { success: true, data: { bookingId: booking.id } };
  } catch (error) {
    console.error("[booking.createBookingRecord]", {
      sessionId: params.sessionId,
      error,
    });
    return { success: false, error: "Failed to create booking record" };
  }
}

export async function createCreatorBookingRecord(params: {
  sessionId: string;
  venueId: string;
  courtId: string;
  startTime: Date;
  endTime: Date;
  creatorId: string;
  courtHourlyRate: number;
}): Promise<ServiceResult<{ bookingId: string }>> {
  try {
    const hours =
      (params.endTime.getTime() - params.startTime.getTime()) / 3_600_000;
    const totalCourtCost = params.courtHourlyRate * Math.max(hours, 1);
    const commissionRate = await getCommissionRate();
    const commissionAmount = totalCourtCost * commissionRate;
    const merchantPayoutAmount = totalCourtCost - commissionAmount;

    const booking = await prisma.booking.create({
      data: {
        sessionId: params.sessionId,
        venueId: params.venueId,
        courtId: params.courtId,
        startTime: params.startTime,
        endTime: params.endTime,
        totalCourtCost,
        totalUpsellCost: 0,
        totalAmount: totalCourtCost,
        commissionRate,
        commissionAmount,
        merchantPayoutAmount,
        creatorId: params.creatorId,
        status: "PENDING",
        playerShares: {
          create: {
            playerId: params.creatorId,
            courtShareAmount: totalCourtCost,
            upsellTotal: 0,
            totalAmount: totalCourtCost,
            isCreator: true,
            status: "PENDING",
          },
        },
      },
    });

    return { success: true, data: { bookingId: booking.id } };
  } catch (error) {
    console.error("[booking.createCreatorBookingRecord]", {
      sessionId: params.sessionId,
      error,
    });
    return { success: false, error: "Failed to create creator booking record" };
  }
}

export async function addUpsellsToPlayerShare(params: {
  bookingId: string;
  playerId: string;
  upsells: Array<{ upsellItemId: string; quantity: number }>;
}): Promise<ServiceResult<{ upsellTotal: number }>> {
  try {
    const share = await prisma.bookingPlayerShare.findFirst({
      where: { bookingId: params.bookingId, playerId: params.playerId },
    });
    if (!share) {
      return {
        success: false,
        error: "Player share not found",
        code: "NOT_FOUND",
      };
    }

    const upsellItems = await prisma.upsellItem.findMany({
      where: {
        id: { in: params.upsells.map((u) => u.upsellItemId) },
        isActive: true,
        deletedAt: null,
      },
    });

    const itemMap = new Map(upsellItems.map((u) => [u.id, u]));
    let upsellTotal = 0;

    const upsellData = params.upsells
      .filter((u) => itemMap.has(u.upsellItemId))
      .map((u) => {
        const item = itemMap.get(u.upsellItemId)!;
        const lineTotal = Number(item.price) * u.quantity;
        upsellTotal += lineTotal;
        return {
          bookingPlayerShareId: share.id,
          upsellItemId: u.upsellItemId,
          name: item.name,
          price: item.price,
          quantity: u.quantity,
        };
      });

    await prisma.$transaction([
      prisma.bookingUpsell.createMany({ data: upsellData }),
      prisma.bookingPlayerShare.update({
        where: { id: share.id },
        data: {
          upsellTotal,
          totalAmount: Number(share.courtShareAmount) + upsellTotal,
        },
      }),
    ]);

    // Update booking totals
    const allShares = await prisma.bookingPlayerShare.findMany({
      where: { bookingId: params.bookingId },
    });
    const newTotalUpsell = allShares.reduce(
      (sum, s) => sum + Number(s.upsellTotal),
      0,
    );
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: params.bookingId },
    });
    const newTotalAmount = Number(booking.totalCourtCost) + newTotalUpsell;
    const commissionRate = Number(booking.commissionRate);
    const newCommission = newTotalAmount * commissionRate;
    const newMerchantPayout = newTotalAmount - newCommission;

    await prisma.booking.update({
      where: { id: params.bookingId },
      data: {
        totalUpsellCost: newTotalUpsell,
        totalAmount: newTotalAmount,
        commissionAmount: newCommission,
        merchantPayoutAmount: newMerchantPayout,
      },
    });

    return { success: true, data: { upsellTotal } };
  } catch (error) {
    console.error("[booking.addUpsellsToPlayerShare]", {
      bookingId: params.bookingId,
      error,
    });
    return { success: false, error: "Failed to add upsells" };
  }
}

export async function markBookingPaid(params: {
  bookingId: string;
  playerId: string;
  stripePaymentIntentId: string;
}): Promise<ServiceResult<{ allPaid: boolean }>> {
  try {
    await prisma.bookingPlayerShare.updateMany({
      where: { bookingId: params.bookingId, playerId: params.playerId },
      data: {
        status: "PAID",
        stripePaymentIntentId: params.stripePaymentIntentId,
      },
    });

    const shares = await prisma.bookingPlayerShare.findMany({
      where: { bookingId: params.bookingId },
    });
    const allPaid = shares.every((s) => s.status === "PAID");

    if (allPaid) {
      await prisma.booking.update({
        where: { id: params.bookingId },
        data: { status: "PAID", paidAt: new Date() },
      });
    }

    return { success: true, data: { allPaid } };
  } catch (error) {
    console.error("[booking.markBookingPaid]", {
      bookingId: params.bookingId,
      error,
    });
    return { success: false, error: "Failed to mark booking paid" };
  }
}

export async function createMerchantPayoutRecord(params: {
  bookingId: string;
  merchantId: string;
  amount: number;
  stripeTransferId: string;
}): Promise<ServiceResult<{ payoutId: string }>> {
  try {
    const payout = await prisma.merchantPayout.create({
      data: {
        merchantId: params.merchantId,
        bookingId: params.bookingId,
        amount: params.amount,
        stripeTransferId: params.stripeTransferId,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
    return { success: true, data: { payoutId: payout.id } };
  } catch (error) {
    console.error("[booking.createMerchantPayoutRecord]", {
      bookingId: params.bookingId,
      error,
    });
    return { success: false, error: "Failed to create payout record" };
  }
}

export async function processRefund(params: {
  bookingId: string;
}): Promise<ServiceResult<null>> {
  try {
    await prisma.$transaction([
      prisma.booking.update({
        where: { id: params.bookingId },
        data: { status: "REFUNDED", refundedAt: new Date() },
      }),
      prisma.bookingPlayerShare.updateMany({
        where: { bookingId: params.bookingId },
        data: { status: "REFUNDED" },
      }),
    ]);
    return { success: true, data: null };
  } catch (error) {
    console.error("[booking.processRefund]", {
      bookingId: params.bookingId,
      error,
    });
    return { success: false, error: "Failed to process refund" };
  }
}

export async function getBookingBySessionId(sessionId: string) {
  return prisma.booking.findUnique({
    where: { sessionId },
    include: {
      playerShares: {
        include: {
          upsells: true,
          player: {
            select: { id: true, displayName: true, avatarUrl: true },
          },
        },
      },
      venue: {
        select: { id: true, name: true, address: true, photoUrls: true },
      },
      court: { select: { id: true, name: true, hourlyRate: true } },
      merchantPayout: true,
    },
  });
}
