import "server-only";

import { prisma } from "@/lib/prisma";
import type { Role, SkillLevel } from "@/generated/prisma/client";

type ServiceResult<T> =
	| { success: true; data: T }
	| { success: false; error: string; code?: string };

export async function findUserByAuthId(authUserId: string) {
	return prisma.user.findUnique({
		where: { authUserId },
		include: { playerProfile: true, merchantProfile: true },
	});
}

export async function createUser(input: {
	authUserId: string;
	email: string;
	displayName: string;
	avatarUrl: string | null;
	role: Role;
}): Promise<ServiceResult<Awaited<ReturnType<typeof prisma.user.create>>>> {
	try {
		const existing = await prisma.user.findUnique({
			where: { authUserId: input.authUserId },
		});
		if (existing) {
			return { success: true, data: existing };
		}

		const user = await prisma.user.create({
			data: {
				authUserId: input.authUserId,
				email: input.email,
				displayName: input.displayName,
				avatarUrl: input.avatarUrl,
				role: input.role,
			},
		});
		return { success: true, data: user };
	} catch (error) {
		console.error("[auth.createUser]", { authUserId: input.authUserId, error });
		return { success: false, error: "Failed to create user" };
	}
}

export async function createPlayerProfile(input: {
	userId: string;
	skillLevel: SkillLevel;
	bio?: string;
	latitude?: number;
	longitude?: number;
}): Promise<
	ServiceResult<Awaited<ReturnType<typeof prisma.playerProfile.create>>>
> {
	try {
		const existing = await prisma.playerProfile.findUnique({
			where: { userId: input.userId },
		});
		if (existing) {
			return { success: true, data: existing };
		}

		const profile = await prisma.playerProfile.create({
			data: {
				userId: input.userId,
				skillLevel: input.skillLevel,
				bio: input.bio,
				latitude: input.latitude,
				longitude: input.longitude,
			},
		});
		return { success: true, data: profile };
	} catch (error) {
		console.error("[auth.createPlayerProfile]", {
			userId: input.userId,
			error,
		});
		return { success: false, error: "Failed to create player profile" };
	}
}

export async function createMerchantProfile(input: {
	userId: string;
	businessName: string;
}): Promise<
	ServiceResult<Awaited<ReturnType<typeof prisma.merchantProfile.create>>>
> {
	try {
		const existing = await prisma.merchantProfile.findUnique({
			where: { userId: input.userId },
		});
		if (existing) {
			return { success: true, data: existing };
		}

		const profile = await prisma.merchantProfile.create({
			data: {
				userId: input.userId,
				businessName: input.businessName,
			},
		});
		return { success: true, data: profile };
	} catch (error) {
		console.error("[auth.createMerchantProfile]", {
			userId: input.userId,
			error,
		});
		return { success: false, error: "Failed to create merchant profile" };
	}
}

export async function isOnboardingComplete(userId: string): Promise<boolean> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		include: { playerProfile: true, merchantProfile: true },
	});
	if (!user) return false;

	if (user.role === "PLAYER") return !!user.playerProfile;
	if (user.role === "MERCHANT") return !!user.merchantProfile;
	return false;
}
