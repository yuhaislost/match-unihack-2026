import "server-only";

import { prisma } from "@/lib/prisma";

const COOLDOWN_DURATION_MS = 600_000; // 10 minutes

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export async function createDeclineCooldown(
  declinerId: string,
  otherPlayerId: string,
): Promise<ServiceResult<{ id: string }>> {
  try {
    const cooldown = await prisma.declineCooldown.create({
      data: {
        playerAId: declinerId,
        playerBId: otherPlayerId,
        expiresAt: new Date(Date.now() + COOLDOWN_DURATION_MS),
      },
    });
    return { success: true, data: { id: cooldown.id } };
  } catch (error) {
    console.error("[cooldown.createDeclineCooldown]", {
      declinerId,
      otherPlayerId,
      error,
    });
    return { success: false, error: "Failed to create cooldown" };
  }
}

export async function getActiveCooldowns(playerId: string): Promise<string[]> {
  const now = new Date();
  const cooldowns = await prisma.declineCooldown.findMany({
    where: {
      expiresAt: { gt: now },
      OR: [{ playerAId: playerId }, { playerBId: playerId }],
    },
  });

  const blockedIds = new Set<string>();
  for (const c of cooldowns) {
    if (c.playerAId === playerId) {
      blockedIds.add(c.playerBId);
    } else {
      blockedIds.add(c.playerAId);
    }
  }
  return Array.from(blockedIds);
}

export async function isCoolingDown(
  playerAId: string,
  playerBId: string,
): Promise<boolean> {
  const now = new Date();
  const count = await prisma.declineCooldown.count({
    where: {
      expiresAt: { gt: now },
      OR: [
        { playerAId, playerBId },
        { playerAId: playerBId, playerBId: playerAId },
      ],
    },
  });
  return count > 0;
}
