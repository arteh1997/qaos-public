import { describe, it, expect } from 'vitest'
import {
  BILLING_CONFIG,
  formatPrice,
  getMonthlyPriceDisplay,
  PRICING_TIERS,
  COUNTRY_CURRENCY,
  getCurrencyForCountry,
  getPricingTier,
} from '@/lib/stripe/billing-config'

describe('Billing Configuration', () => {
  describe('BILLING_CONFIG constants', () => {
    it('should have correct price amount in pence', () => {
      expect(BILLING_CONFIG.PRICE_AMOUNT_PENCE).toBe(29900)
    })

    it('should have GBP as currency', () => {
      expect(BILLING_CONFIG.CURRENCY).toBe('gbp')
    })

    it('should have 30-day trial period', () => {
      expect(BILLING_CONFIG.TRIAL_DAYS).toBe(30)
    })

    it('should have correct product name', () => {
      expect(BILLING_CONFIG.PRODUCT_NAME).toBe('Restaurant Inventory Management')
    })

    it('should have an array of features', () => {
      expect(Array.isArray(BILLING_CONFIG.FEATURES)).toBe(true)
      expect(BILLING_CONFIG.FEATURES.length).toBeGreaterThan(0)
    })

    it('should include key features', () => {
      expect(BILLING_CONFIG.FEATURES).toContain('Unlimited inventory items')
      expect(BILLING_CONFIG.FEATURES).toContain('Stock count & reception tracking')
      expect(BILLING_CONFIG.FEATURES).toContain('Low stock alerts & reports')
      expect(BILLING_CONFIG.FEATURES).toContain('Multi-store support')
    })
  })

  describe('formatPrice', () => {
    it('should format GBP price correctly', () => {
      expect(formatPrice(29900, 'gbp')).toBe('£299.00')
    })

    it('should format different amounts correctly', () => {
      expect(formatPrice(100, 'gbp')).toBe('£1.00')
      expect(formatPrice(9999, 'gbp')).toBe('£99.99')
      expect(formatPrice(0, 'gbp')).toBe('£0.00')
    })

    it('should handle USD currency', () => {
      // en-US locale formats USD as $
      expect(formatPrice(10000, 'usd')).toBe('$100.00')
    })

    it('should handle EUR currency', () => {
      // de-DE locale formats EUR as X,XX €
      expect(formatPrice(5000, 'eur')).toBe('50,00\u00a0€')
    })

    it('should default to GBP when currency not specified', () => {
      expect(formatPrice(1000)).toBe('£10.00')
    })

    it('should handle case-insensitive currency codes', () => {
      expect(formatPrice(1000, 'GBP')).toBe('£10.00')
      expect(formatPrice(1000, 'Gbp')).toBe('£10.00')
    })

    it('should handle large amounts', () => {
      expect(formatPrice(999999, 'gbp')).toBe('£9,999.99')
    })

    it('should handle fractional pence by rounding', () => {
      // formatPrice expects integer pence, but testing edge case
      expect(formatPrice(50, 'gbp')).toBe('£0.50')
    })
  })

  describe('getMonthlyPriceDisplay', () => {
    it('should return pricing tier label for GBP', () => {
      expect(getMonthlyPriceDisplay()).toBe('£299/month')
    })

    it('should return pricing tier label for specified currency', () => {
      expect(getMonthlyPriceDisplay('USD')).toBe('$299/month')
      expect(getMonthlyPriceDisplay('SAR')).toBe('SAR 1,099/month')
      expect(getMonthlyPriceDisplay('EUR')).toBe('€279/month')
    })

    it('should fall back to GBP for unknown currency', () => {
      expect(getMonthlyPriceDisplay('XYZ')).toBe('£299/month')
    })
  })

  describe('Multi-Currency Pricing', () => {
    it('should have all expected currencies in PRICING_TIERS', () => {
      expect(Object.keys(PRICING_TIERS)).toEqual(
        expect.arrayContaining(['GBP', 'USD', 'EUR', 'SAR', 'AED', 'AUD', 'CAD', 'INR'])
      )
    })

    it('getCurrencyForCountry should resolve known countries', () => {
      expect(getCurrencyForCountry('GB')).toBe('GBP')
      expect(getCurrencyForCountry('US')).toBe('USD')
      expect(getCurrencyForCountry('SA')).toBe('SAR')
      expect(getCurrencyForCountry('DE')).toBe('EUR')
      expect(getCurrencyForCountry('AU')).toBe('AUD')
    })

    it('getCurrencyForCountry should fall back to GBP for unknown', () => {
      expect(getCurrencyForCountry('ZZ')).toBe('GBP')
    })

    it('getCurrencyForCountry should be case insensitive', () => {
      expect(getCurrencyForCountry('gb')).toBe('GBP')
      expect(getCurrencyForCountry('us')).toBe('USD')
    })

    it('getPricingTier should return correct tier', () => {
      const gbp = getPricingTier('GBP')
      expect(gbp.amount).toBe(29900)
      expect(gbp.currency).toBe('gbp')
      expect(gbp.symbol).toBe('£')
    })

    it('getPricingTier should fall back to GBP for unknown', () => {
      expect(getPricingTier('XYZ')).toEqual(PRICING_TIERS.GBP)
    })

    it('COUNTRY_CURRENCY should map Gulf states to SAR', () => {
      expect(COUNTRY_CURRENCY.BH).toBe('SAR')
      expect(COUNTRY_CURRENCY.KW).toBe('SAR')
      expect(COUNTRY_CURRENCY.OM).toBe('SAR')
      expect(COUNTRY_CURRENCY.QA).toBe('SAR')
    })
  })
})
