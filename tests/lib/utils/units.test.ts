import { describe, it, expect } from 'vitest'
import { normalizeUnit, convertQuantity } from '@/lib/utils/units'

describe('normalizeUnit', () => {
  it('normalizes weight unit variants', () => {
    expect(normalizeUnit('grams')).toBe('g')
    expect(normalizeUnit('gram')).toBe('g')
    expect(normalizeUnit('g')).toBe('g')
    expect(normalizeUnit('kg')).toBe('kg')
    expect(normalizeUnit('kilogram')).toBe('kg')
    expect(normalizeUnit('kilograms')).toBe('kg')
    expect(normalizeUnit('oz')).toBe('oz')
    expect(normalizeUnit('ounce')).toBe('oz')
    expect(normalizeUnit('ounces')).toBe('oz')
    expect(normalizeUnit('lb')).toBe('lb')
    expect(normalizeUnit('lbs')).toBe('lb')
    expect(normalizeUnit('pound')).toBe('lb')
    expect(normalizeUnit('pounds')).toBe('lb')
  })

  it('normalizes volume unit variants', () => {
    expect(normalizeUnit('ml')).toBe('ml')
    expect(normalizeUnit('millilitre')).toBe('ml')
    expect(normalizeUnit('milliliter')).toBe('ml')
    expect(normalizeUnit('millilitres')).toBe('ml')
    expect(normalizeUnit('milliliters')).toBe('ml')
    expect(normalizeUnit('l')).toBe('l')
    expect(normalizeUnit('liter')).toBe('l')
    expect(normalizeUnit('litre')).toBe('l')
    expect(normalizeUnit('liters')).toBe('l')
    expect(normalizeUnit('litres')).toBe('l')
  })

  it('normalizes counting unit variants', () => {
    expect(normalizeUnit('each')).toBe('each')
    expect(normalizeUnit('pcs')).toBe('each')
    expect(normalizeUnit('piece')).toBe('each')
    expect(normalizeUnit('pieces')).toBe('each')
    expect(normalizeUnit('unit')).toBe('each')
    expect(normalizeUnit('units')).toBe('each')
  })

  it('is case insensitive', () => {
    expect(normalizeUnit('Grams')).toBe('g')
    expect(normalizeUnit('KG')).toBe('kg')
    expect(normalizeUnit('LITRES')).toBe('l')
    expect(normalizeUnit('Pieces')).toBe('each')
  })

  it('trims whitespace', () => {
    expect(normalizeUnit('  grams  ')).toBe('g')
    expect(normalizeUnit(' kg ')).toBe('kg')
  })

  it('returns unknown units lowercased', () => {
    expect(normalizeUnit('box')).toBe('box')
    expect(normalizeUnit('bag')).toBe('bag')
    expect(normalizeUnit('case')).toBe('case')
    expect(normalizeUnit('bottle')).toBe('bottle')
    expect(normalizeUnit('Slices')).toBe('slices')
  })
})

describe('convertQuantity', () => {
  describe('weight conversions', () => {
    it('converts grams to kg', () => {
      expect(convertQuantity(200, 'grams', 'kg')).toBe(0.2)
      expect(convertQuantity(1000, 'g', 'kg')).toBe(1)
      expect(convertQuantity(50, 'grams', 'kg')).toBeCloseTo(0.05)
    })

    it('converts kg to grams', () => {
      expect(convertQuantity(1.5, 'kg', 'grams')).toBe(1500)
      expect(convertQuantity(0.2, 'kg', 'g')).toBe(200)
    })

    it('converts oz to lb', () => {
      expect(convertQuantity(16, 'oz', 'lb')).toBe(1)
      expect(convertQuantity(8, 'oz', 'lb')).toBe(0.5)
    })

    it('converts lb to oz', () => {
      expect(convertQuantity(3, 'lb', 'oz')).toBe(48)
      expect(convertQuantity(0.5, 'lb', 'oz')).toBe(8)
    })
  })

  describe('volume conversions', () => {
    it('converts ml to litres', () => {
      expect(convertQuantity(500, 'ml', 'litres')).toBe(0.5)
      expect(convertQuantity(1000, 'ml', 'l')).toBe(1)
      expect(convertQuantity(250, 'ml', 'litre')).toBe(0.25)
    })

    it('converts litres to ml', () => {
      expect(convertQuantity(2, 'litres', 'ml')).toBe(2000)
      expect(convertQuantity(0.5, 'litre', 'ml')).toBe(500)
      expect(convertQuantity(1, 'liters', 'ml')).toBe(1000)
    })
  })

  describe('same unit', () => {
    it('returns quantity unchanged for identical units', () => {
      expect(convertQuantity(10, 'kg', 'kg')).toBe(10)
      expect(convertQuantity(5, 'litres', 'litres')).toBe(5)
      expect(convertQuantity(3, 'each', 'each')).toBe(3)
    })

    it('returns quantity unchanged for equivalent units', () => {
      expect(convertQuantity(5, 'each', 'pieces')).toBe(5)
      expect(convertQuantity(7, 'pcs', 'each')).toBe(7)
      expect(convertQuantity(3, 'grams', 'g')).toBe(3)
      expect(convertQuantity(2, 'litres', 'liter')).toBe(2)
    })
  })

  describe('incompatible units', () => {
    it('returns null for weight vs volume', () => {
      expect(convertQuantity(100, 'g', 'litres')).toBeNull()
      expect(convertQuantity(1, 'kg', 'ml')).toBeNull()
    })

    it('returns null for weight vs counting', () => {
      expect(convertQuantity(100, 'kg', 'each')).toBeNull()
      expect(convertQuantity(5, 'pieces', 'g')).toBeNull()
    })

    it('returns null for volume vs counting', () => {
      expect(convertQuantity(1, 'litres', 'each')).toBeNull()
      expect(convertQuantity(10, 'pieces', 'ml')).toBeNull()
    })

    it('returns null for unknown different units', () => {
      expect(convertQuantity(5, 'box', 'bag')).toBeNull()
      expect(convertQuantity(3, 'case', 'bottle')).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('handles zero quantity', () => {
      expect(convertQuantity(0, 'g', 'kg')).toBe(0)
      expect(convertQuantity(0, 'ml', 'litres')).toBe(0)
    })

    it('is case insensitive', () => {
      expect(convertQuantity(1, 'KG', 'Grams')).toBe(1000)
      expect(convertQuantity(500, 'ML', 'LITRES')).toBe(0.5)
    })

    it('handles unknown but same units', () => {
      expect(convertQuantity(5, 'box', 'box')).toBe(5)
      expect(convertQuantity(10, 'tray', 'tray')).toBe(10)
    })

    it('handles very small quantities', () => {
      expect(convertQuantity(0.001, 'kg', 'g')).toBe(1)
      expect(convertQuantity(1, 'ml', 'l')).toBe(0.001)
    })

    it('handles very large quantities', () => {
      expect(convertQuantity(50000, 'g', 'kg')).toBe(50)
      expect(convertQuantity(10000, 'ml', 'l')).toBe(10)
    })
  })
})
