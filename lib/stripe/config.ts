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

import Stripe from 'stripe'

// Re-export billing config for convenience in server-side code
export * from './billing-config'

// Initialize Stripe client (server-side only)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
})
