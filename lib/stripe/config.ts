/**
 * Stripe Configuration
 *
 * Environment variables required:
 * - STRIPE_SECRET_KEY: Server-side API key
 * - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: Client-side publishable key
 * - STRIPE_WEBHOOK_SECRET: Webhook signing secret
 * - STRIPE_PRICE_ID: The Price ID for the monthly subscription
 */

import Stripe from 'stripe'

// Validate required environment variables
const requiredEnvVars = {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
}

// Check for missing env vars (only in server context)
if (typeof window === 'undefined') {
  const missing = Object.entries(requiredEnvVars)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0 && process.env.NODE_ENV === 'production') {
    console.warn(`Missing Stripe environment variables: ${missing.join(', ')}`)
  }
}

// Initialize Stripe client (server-side only)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27.acacia',
  typescript: true,
})

// Billing configuration
export const BILLING_CONFIG = {
  // Price per store per month in pence (£299.00)
  PRICE_AMOUNT_PENCE: 29900,

  // Currency
  CURRENCY: 'gbp' as const,

  // Trial period in days
  TRIAL_DAYS: 30,

  // Product name for display
  PRODUCT_NAME: 'Restaurant Inventory Management',

  // Features included (for display)
  FEATURES: [
    'Unlimited inventory items',
    'Stock count & reception tracking',
    'Low stock alerts & reports',
    'Shift scheduling & time tracking',
    'Team management with roles',
    'Multi-store support',
    'Audit logging',
    'Email support',
  ],
} as const

// Subscription statuses
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid'

// Helper to format price for display
export function formatPrice(amountPence: number, currency: string = 'gbp'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountPence / 100)
}

// Get the monthly price display string
export function getMonthlyPriceDisplay(): string {
  return formatPrice(BILLING_CONFIG.PRICE_AMOUNT_PENCE, BILLING_CONFIG.CURRENCY)
}
