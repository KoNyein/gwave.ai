import "server-only";

import Stripe from "stripe";

/**
 * Lazily constructed Stripe client. Server-only — the secret key must never
 * reach the client bundle. Throws when STRIPE_SECRET_KEY is not configured
 * so misconfiguration fails loudly instead of silently skipping billing.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  return new Stripe(key);
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
