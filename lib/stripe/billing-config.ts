/**
 * Billing Configuration (Client-safe)
 *
 * This file contains billing constants that can be safely imported
 * on both client and server side. No Stripe SDK initialization here.
 *
 * Supports multi-currency pricing based on store country.
 */

// ── Pricing Tier per Currency ──

export interface PricingTier {
  amount: number      // In smallest currency unit (pence, cents, etc.)
  currency: string    // Stripe currency code (lowercase)
  symbol: string      // Display symbol
  locale: string      // Intl locale for formatting
  label: string       // Display label e.g. "£299/month"
}

export const PRICING_TIERS: Record<string, PricingTier> = {
  GBP: { amount: 29900, currency: 'gbp', symbol: '£', locale: 'en-GB', label: '£299/month' },
  USD: { amount: 29900, currency: 'usd', symbol: '$', locale: 'en-US', label: '$299/month' },
  EUR: { amount: 27900, currency: 'eur', symbol: '€', locale: 'de-DE', label: '€279/month' },
  SAR: { amount: 109900, currency: 'sar', symbol: 'SAR ', locale: 'ar-SA', label: 'SAR 1,099/month' },
  AED: { amount: 109900, currency: 'aed', symbol: 'AED ', locale: 'ar-AE', label: 'AED 1,099/month' },
  AUD: { amount: 44900, currency: 'aud', symbol: 'A$', locale: 'en-AU', label: 'A$449/month' },
  CAD: { amount: 39900, currency: 'cad', symbol: 'C$', locale: 'en-CA', label: 'C$399/month' },
  INR: { amount: 2499900, currency: 'inr', symbol: '₹', locale: 'en-IN', label: '₹24,999/month' },
}

// ── Country → Currency Mapping ──

export const COUNTRY_CURRENCY: Record<string, string> = {
  // Americas
  US: 'USD', CA: 'CAD',
  // UK
  GB: 'GBP',
  // Middle East
  SA: 'SAR', AE: 'AED', BH: 'SAR', KW: 'SAR', OM: 'SAR', QA: 'SAR',
  // Asia-Pacific
  AU: 'AUD', NZ: 'AUD', IN: 'INR',
  // Europe (EUR)
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR',
  BE: 'EUR', AT: 'EUR', PT: 'EUR', IE: 'EUR', FI: 'EUR',
  GR: 'EUR', LU: 'EUR', SK: 'EUR', SI: 'EUR', EE: 'EUR',
  LV: 'EUR', LT: 'EUR', MT: 'EUR', CY: 'EUR', HR: 'EUR',
}

/**
 * Resolve the billing currency for a store based on its country.
 * Falls back to GBP if country is unknown.
 */
export function getCurrencyForCountry(countryCode: string): string {
  return COUNTRY_CURRENCY[countryCode.toUpperCase()] || 'GBP'
}

/**
 * Get the pricing tier for a currency. Falls back to GBP.
 */
export function getPricingTier(currencyCode: string): PricingTier {
  return PRICING_TIERS[currencyCode.toUpperCase()] || PRICING_TIERS.GBP
}

// ── Volume Discount Tiers ──
// Discount applies to the entire monthly bill (all stores)

export interface VolumeDiscount {
  minStores: number
  discountPercent: number
  label: string
}

export const VOLUME_DISCOUNTS: VolumeDiscount[] = [
  { minStores: 5, discountPercent: 10, label: '10% off' },
  { minStores: 10, discountPercent: 20, label: '20% off' },
]

/**
 * Get the volume discount percentage for a given number of stores.
 * Returns 0 if no discount applies.
 */
export function getVolumeDiscount(storeCount: number): VolumeDiscount | null {
  // Walk backwards to find the highest applicable tier
  for (let i = VOLUME_DISCOUNTS.length - 1; i >= 0; i--) {
    if (storeCount >= VOLUME_DISCOUNTS[i].minStores) {
      return VOLUME_DISCOUNTS[i]
    }
  }
  return null
}

/**
 * Calculate the total monthly bill with volume discount applied.
 * Returns amount in smallest currency unit (pence/cents).
 */
export function calculateMonthlyBill(
  storeCount: number,
  currencyCode: string = 'GBP'
): { subtotal: number; discount: number; total: number; discountPercent: number } {
  const tier = getPricingTier(currencyCode)
  const subtotal = tier.amount * storeCount
  const volumeDiscount = getVolumeDiscount(storeCount)
  const discountPercent = volumeDiscount?.discountPercent ?? 0
  const discount = Math.round(subtotal * (discountPercent / 100))
  return {
    subtotal,
    discount,
    total: subtotal - discount,
    discountPercent,
  }
}

// ── Legacy BILLING_CONFIG (backwards-compatible) ──

export const BILLING_CONFIG = {
  // Default price (GBP — kept for backwards compatibility)
  PRICE_AMOUNT_PENCE: 29900,
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

/**
 * Format a price amount for display using the appropriate locale.
 */
export function formatPrice(amountMinor: number, currency: string = 'gbp'): string {
  const tier = PRICING_TIERS[currency.toUpperCase()]
  const locale = tier?.locale || 'en-GB'

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountMinor / 100)
}

/**
 * Get the monthly price display string for a given currency.
 */
export function getMonthlyPriceDisplay(currency?: string): string {
  const tier = getPricingTier(currency || 'GBP')
  return tier.label
}
