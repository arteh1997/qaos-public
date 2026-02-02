/**
 * Billing Configuration (Client-safe)
 *
 * This file contains billing constants that can be safely imported
 * on both client and server side. No Stripe SDK initialization here.
 */

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
