import "server-only";

import { createServiceRoleClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import {
	createUser,
	createPlayerProfile,
	createMerchantProfile,
} from "@/lib/services/auth";
import type { Role, SkillLevel } from "@/generated/prisma/client";

type ServiceResult<T> =
	| { success: true; data: T }
	| { success: false; error: string };

export async function selectRole(input: {
	authUserId: string;
	email: string;
	displayName: string;
	avatarUrl: string | null;
	role: Role;
}): Promise<ServiceResult<Awaited<ReturnType<typeof prisma.user.findUnique>>>> {
	const userResult = await createUser(input);
	if (!userResult.success) {
		return userResult;
	}

	// Set role in Supabase app_metadata so middleware can read it without a DB call
	const supabaseAdmin = createServiceRoleClient();
	const { error } = await supabaseAdmin.auth.admin.updateUserById(
		input.authUserId,
		{
			app_metadata: { role: input.role },
		},
	);
	if (error) {
		console.error("[selectRole] Failed to set app_metadata", {
			authUserId: input.authUserId,
			error,
		});
		return { success: false, error: "Failed to update user metadata" };
	}

	// Create default notification preferences
	try {
		await prisma.notificationPreference.upsert({
			where: { userId: userResult.data.id },
			update: {},
			create: { userId: userResult.data.id },
		});
	} catch (error) {
		console.error("[selectRole] Failed to create notification preferences", {
			error,
		});
		// Non-critical, continue
	}

	return { success: true, data: userResult.data };
}

export async function completePlayerOnboarding(input: {
	userId: string;
	skillLevel: SkillLevel;
	bio?: string;
	latitude?: number;
	longitude?: number;
}): Promise<ServiceResult<{ complete: true }>> {
	const result = await createPlayerProfile(input);
	if (!result.success) {
		return result;
	}
	return { success: true, data: { complete: true } };
}

export async function completeMerchantOnboarding(input: {
	userId: string;
	businessName: string;
}): Promise<ServiceResult<{ complete: true }>> {
	const result = await createMerchantProfile(input);
	if (!result.success) {
		return result;
	}
	return { success: true, data: { complete: true } };
}
