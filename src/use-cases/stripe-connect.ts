import "server-only";

import { prisma } from "@/lib/prisma";
import { createAccountLink, createConnectAccount } from "@/lib/stripe";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export async function onboardMerchant(
  userId: string,
): Promise<ServiceResult<{ onboardingUrl: string }>> {
  try {
    const merchant = await prisma.merchantProfile.findUnique({
      where: { userId },
      include: { user: { select: { email: true } } },
    });
    if (!merchant) {
      return {
        success: false,
        error: "Merchant profile not found",
        code: "NOT_FOUND",
      };
    }

    let accountId = merchant.stripeConnectAccountId;

    // Create Connect account if needed
    if (!accountId) {
      const account = await createConnectAccount({
        email: merchant.user.email,
        businessName: merchant.businessName,
      });
      accountId = account.id;

      await prisma.merchantProfile.update({
        where: { id: merchant.id },
        data: { stripeConnectAccountId: accountId },
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const accountLink = await createAccountLink({
      accountId,
      refreshUrl: `${baseUrl}/dashboard/settings?stripe=refresh`,
      returnUrl: `${baseUrl}/dashboard/settings?stripe=complete`,
    });

    return { success: true, data: { onboardingUrl: accountLink.url } };
  } catch (error) {
    console.error("[stripe-connect.onboardMerchant]", { userId, error });
    return { success: false, error: "Failed to start Stripe onboarding" };
  }
}

export async function handleAccountUpdated(
  stripeAccountId: string,
): Promise<ServiceResult<null>> {
  try {
    const merchant = await prisma.merchantProfile.findFirst({
      where: { stripeConnectAccountId: stripeAccountId },
    });
    if (!merchant) {
      // Not our account — ignore
      return { success: true, data: null };
    }

    // We can't call retrieveAccount here because we need the charges_enabled
    // field from the event payload. The caller should pass this in.
    // For now, we'll retrieve it from Stripe directly.
    const { retrieveAccount } = await import("@/lib/stripe");
    const account = await retrieveAccount(stripeAccountId);

    await prisma.merchantProfile.update({
      where: { id: merchant.id },
      data: {
        stripeChargesEnabled: account.charges_enabled ?? false,
        stripeOnboardingComplete: account.details_submitted ?? false,
      },
    });

    return { success: true, data: null };
  } catch (error) {
    console.error("[stripe-connect.handleAccountUpdated]", {
      stripeAccountId,
      error,
    });
    return { success: false, error: "Failed to handle account update" };
  }
}
