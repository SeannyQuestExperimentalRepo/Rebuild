import "server-only";

import Stripe from "stripe";

/**
 * Stripe client singleton.
 *
 * All Stripe env vars are optional — routes using this will fail gracefully
 * if keys aren't configured. The `features.SUBSCRIPTIONS_ACTIVE` flag in
 * config.ts guards the frontend; this guards the backend.
 */

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

function getStripe(): Stripe {
  if (!stripeSecretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured. Set it in .env to enable billing.",
    );
  }
  return new Stripe(stripeSecretKey, {
    typescript: true,
  });
}

/** Lazily-initialized Stripe instance */
export const stripe = stripeSecretKey ? getStripe() : (null as unknown as Stripe);

/** Check if Stripe is configured before using */
export function isStripeConfigured(): boolean {
  return !!stripeSecretKey && !!process.env.STRIPE_WEBHOOK_SECRET;
}

/** Stripe price IDs from env (set in Stripe Dashboard) */
export const STRIPE_PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY ?? "",
  annual: process.env.STRIPE_PRICE_ANNUAL ?? "",
} as const;
