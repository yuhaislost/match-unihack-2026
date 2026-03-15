import "server-only";

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

// ─── Checkout ───

export async function createCheckoutSession(params: {
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  paymentIntentData?: Stripe.Checkout.SessionCreateParams.PaymentIntentData;
}): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    mode: "payment",
    line_items: params.lineItems,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
    payment_intent_data: params.paymentIntentData,
  });
}

export async function retrieveCheckoutSession(
  sessionId: string,
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.retrieve(sessionId);
}

// ─── Webhooks ───

export function constructWebhookEvent(
  body: string | Buffer,
  signature: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );
}

// ─── Connect ───

export async function createConnectAccount(params: {
  email: string;
  businessName: string;
}): Promise<Stripe.Account> {
  return stripe.accounts.create({
    type: "standard",
    email: params.email,
    business_profile: {
      name: params.businessName,
    },
  });
}

export async function createAccountLink(params: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}): Promise<Stripe.AccountLink> {
  return stripe.accountLinks.create({
    account: params.accountId,
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
    type: "account_onboarding",
  });
}

export async function retrieveAccount(
  accountId: string,
): Promise<Stripe.Account> {
  return stripe.accounts.retrieve(accountId);
}

// ─── Transfers ───

export async function createTransfer(params: {
  amount: number;
  currency: string;
  destination: string;
  transferGroup?: string;
}): Promise<Stripe.Transfer> {
  return stripe.transfers.create({
    amount: params.amount,
    currency: params.currency,
    destination: params.destination,
    transfer_group: params.transferGroup,
  });
}

// ─── Refunds ───

export async function createRefund(params: {
  paymentIntentId: string;
  amount?: number;
}): Promise<Stripe.Refund> {
  return stripe.refunds.create({
    payment_intent: params.paymentIntentId,
    amount: params.amount,
  });
}
