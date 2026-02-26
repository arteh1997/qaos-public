/**
 * Unit conversion utility for recipe costing.
 *
 * Converts between compatible units (g↔kg, ml↔l, oz↔lb)
 * so recipe ingredient costs calculate correctly when the recipe
 * unit differs from the inventory tracking unit.
 */

const UNIT_ALIASES: Record<string, string> = {
  // Weight
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  // Volume
  ml: 'ml',
  millilitre: 'ml',
  milliliter: 'ml',
  millilitres: 'ml',
  milliliters: 'ml',
  l: 'l',
  liter: 'l',
  litre: 'l',
  liters: 'l',
  litres: 'l',
  // Counting
  each: 'each',
  pcs: 'each',
  piece: 'each',
  pieces: 'each',
  unit: 'each',
  units: 'each',
}

/**
 * Normalize a unit string to its canonical form.
 * e.g. "grams" → "g", "litres" → "l", "pieces" → "each"
 */
export function normalizeUnit(unit: string): string {
  const lower = unit.toLowerCase().trim()
  return UNIT_ALIASES[lower] ?? lower
}

// Conversion factors: [fromUnit][toUnit] = factor
// quantity_in_toUnit = quantity_in_fromUnit * factor
const CONVERSION_FACTORS: Record<string, Record<string, number>> = {
  g: { kg: 0.001 },
  kg: { g: 1000 },
  ml: { l: 0.001 },
  l: { ml: 1000 },
  oz: { lb: 0.0625 },
  lb: { oz: 16 },
}

/**
 * Convert a quantity from one unit to another.
 *
 * @returns The converted quantity, or null if the units are incompatible.
 *          Returns the original quantity if both units normalize to the same thing.
 */
export function convertQuantity(
  qty: number,
  fromUnit: string,
  toUnit: string
): number | null {
  const from = normalizeUnit(fromUnit)
  const to = normalizeUnit(toUnit)

  // Same unit after normalization
  if (from === to) return qty

  // Look up conversion factor
  const factor = CONVERSION_FACTORS[from]?.[to]
  if (factor !== undefined) return qty * factor

  // No known conversion
  return null
}
