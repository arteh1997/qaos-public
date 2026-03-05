/**
 * Stripe Server Configuration
 *
 * WARNING: This file initializes the Stripe SDK and should ONLY be imported
 * in server-side code (API routes, server components, etc).
 * For client-side code, import from '@/lib/stripe/billing-config' instead.
 *
 * Environment variables required:
 * - STRIPE_SECRET_KEY: Server-side API key
 * - STRIPE_WEBHOOK_SECRET: Webhook signing secret
 */

import Stripe from "stripe";

// Re-export billing config for convenience in server-side code
export * from "./billing-config";

// Initialize Stripe client lazily to avoid throwing when STRIPE_SECRET_KEY
// is not set (e.g. during CI builds or static page collection).
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
  }
  return _stripe;
}

/** @deprecated Use `getStripe()` instead — kept for backwards compatibility */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
