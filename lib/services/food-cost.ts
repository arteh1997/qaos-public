/**
 * Food Cost Analysis Service
 *
 * Calculates actual vs theoretical food cost by combining:
 * - Recipe ingredient costs (theoretical)
 * - POS sale events (units sold)
 * - Stock history (actual COGS via inventory method)
 * - Waste logs (attributable waste)
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { convertQuantity } from '@/lib/utils/units'

// ── Types ──

export interface FoodCostParams {
  storeId: string
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
  categoryId?: string
  menuItemId?: string
}

export interface FoodCostSummary {
  theoretical_cost: number
  actual_cost: number
  variance: number
  variance_percentage: number
  total_revenue: number
  theoretical_food_cost_pct: number
  actual_food_cost_pct: number
  waste_cost: number
  unaccounted_variance: number
  period_start: string
  period_end: string
}

export interface FoodCostItem {
  menu_item_id: string
  name: string
  category: string | null
  units_sold: number
  theoretical_cost_per_unit: number
  theoretical_cost_total: number
  waste_attributed: number
  selling_price: number
  revenue: number
  food_cost_pct: number
}

export interface FoodCostCategory {
  category: string
  item_count: number
  theoretical_cost: number
  revenue: number
  food_cost_pct: number
}

export interface FoodCostTrend {
  date: string
  theoretical: number
  actual: number
}

export interface FoodCostReport {
  summary: FoodCostSummary
  items: FoodCostItem[]
  categories: FoodCostCategory[]
  trends: FoodCostTrend[]
}

// ── Core Engine ──

/**
 * Calculate theoretical cost per menu item portion.
 * Reuses the same logic as menu-analysis/route.ts — recipe ingredients × unit cost ÷ yield.
 */
async function calculateRecipeCost(
  supabase: SupabaseClient,
  storeId: string,
  recipeId: string,
  yieldQuantity: number
): Promise<number> {
  const { data: ingredients } = await supabase
    .from('recipe_ingredients')
    .select('quantity, inventory_item_id, unit_of_measure')
    .eq('recipe_id', recipeId)

  if (!ingredients || ingredients.length === 0) return 0

  const itemIds = ingredients.map((i: { inventory_item_id: string }) => i.inventory_item_id)

  const { data: inventoryData } = await supabase
    .from('store_inventory')
    .select('inventory_item_id, unit_cost')
    .eq('store_id', storeId)
    .in('inventory_item_id', itemIds)

  const { data: itemData } = await supabase
    .from('inventory_items')
    .select('id, unit_of_measure')
    .in('id', itemIds)

  const costMap = new Map(
    (inventoryData || []).map((inv: { inventory_item_id: string; unit_cost: number }) => [
      inv.inventory_item_id,
      Number(inv.unit_cost || 0),
    ])
  )

  const unitMap = new Map(
    (itemData || []).map((item: { id: string; unit_of_measure: string }) => [
      item.id,
      item.unit_of_measure,
    ])
  )

  const totalCost = ingredients.reduce(
    (sum: number, ing: { inventory_item_id: string; quantity: number; unit_of_measure: string | null }) => {
      const unitCost = costMap.get(ing.inventory_item_id) || 0
      const recipeUnit = ing.unit_of_measure || ''
      const inventoryUnit = unitMap.get(ing.inventory_item_id) || ''
      const convertedQty = convertQuantity(Number(ing.quantity), recipeUnit, inventoryUnit)
      const effectiveQty = convertedQty !== null ? convertedQty : Number(ing.quantity)
      return sum + (effectiveQty * unitCost)
    },
    0
  )

  return yieldQuantity > 0 ? totalCost / yieldQuantity : totalCost
}

/**
 * Get POS units sold per inventory item in a date range.
 * Joins pos_sale_events → pos_item_mappings to resolve inventory item quantities.
 */
async function getUnitsSoldByMenuItem(
  supabase: SupabaseClient,
  storeId: string,
  startDate: string,
  endDate: string
): Promise<Map<string, number>> {
  // Get all mappings for this store (menu item → inventory item → quantity_per_sale)
  const { data: mappings } = await supabase
    .from('pos_item_mappings')
    .select('pos_item_id, inventory_item_id, quantity_per_sale')
    .eq('store_id', storeId)
    .eq('is_active', true)

  if (!mappings || mappings.length === 0) return new Map()

  // Get sale events in the date range
  const { data: events } = await supabase
    .from('pos_sale_events')
    .select('items, event_type')
    .eq('store_id', storeId)
    .eq('status', 'processed')
    .gte('occurred_at', `${startDate}T00:00:00.000Z`)
    .lte('occurred_at', `${endDate}T23:59:59.999Z`)

  if (!events || events.length === 0) return new Map()

  // Build a lookup from pos_item_id to the mapping
  const posItemMap = new Map<string, { inventory_item_id: string; quantity_per_sale: number }>()
  for (const m of mappings) {
    posItemMap.set(m.pos_item_id, {
      inventory_item_id: m.inventory_item_id,
      quantity_per_sale: Number(m.quantity_per_sale),
    })
  }

  // Count sold quantities per inventory item
  const soldMap = new Map<string, number>()

  for (const event of events) {
    const multiplier = event.event_type === 'refund' ? -1 : 1
    const items = event.items as Array<{ pos_item_id: string; quantity: number }>
    if (!Array.isArray(items)) continue

    for (const item of items) {
      const mapping = posItemMap.get(item.pos_item_id)
      if (!mapping) continue

      const qty = (Number(item.quantity) || 0) * multiplier
      const current = soldMap.get(mapping.inventory_item_id) || 0
      soldMap.set(mapping.inventory_item_id, current + qty)
    }
  }

  return soldMap
}

/**
 * Calculate actual COGS using the inventory method:
 * COGS = Beginning Inventory + Purchases - Ending Inventory
 */
async function calculateActualCOGS(
  supabase: SupabaseClient,
  storeId: string,
  startDate: string,
  endDate: string
): Promise<{ actualCost: number; trends: FoodCostTrend[] }> {
  // Get all stock counts (snapshots) in the period
  // "Beginning" = last count on or before startDate
  // "Ending" = last count on or before endDate
  const { data: stockHistory } = await supabase
    .from('stock_history')
    .select('action_type, quantity_before, quantity_after, quantity_change, inventory_item_id, created_at')
    .eq('store_id', storeId)
    .gte('created_at', `${startDate}T00:00:00.000Z`)
    .lte('created_at', `${endDate}T23:59:59.999Z`)
    .order('created_at', { ascending: true })

  if (!stockHistory || stockHistory.length === 0) {
    return { actualCost: 0, trends: [] }
  }

  // Get unit costs for all items referenced
  const itemIds = [...new Set(stockHistory.map(h => h.inventory_item_id))]
  const { data: inventoryData } = await supabase
    .from('store_inventory')
    .select('inventory_item_id, unit_cost')
    .eq('store_id', storeId)
    .in('inventory_item_id', itemIds)

  const costMap = new Map(
    (inventoryData || []).map((inv: { inventory_item_id: string; unit_cost: number }) => [
      inv.inventory_item_id,
      Number(inv.unit_cost || 0),
    ])
  )

  // Sum up receptions (purchases) — these add to COGS
  let totalPurchases = 0
  for (const h of stockHistory) {
    if (h.action_type === 'Reception') {
      const qty = Math.abs(Number(h.quantity_change || 0))
      const cost = costMap.get(h.inventory_item_id) || 0
      totalPurchases += qty * cost
    }
  }

  // For COGS calculation, use the simplified approach:
  // Sum of all consumption-type events (Sale, Waste, Adjustment negatives)
  let actualCost = 0
  for (const h of stockHistory) {
    const change = Number(h.quantity_change || 0)
    const cost = costMap.get(h.inventory_item_id) || 0

    if (h.action_type === 'Sale' || h.action_type === 'Waste') {
      // Sales and waste are negative changes — cost of goods consumed
      actualCost += Math.abs(change) * cost
    } else if (h.action_type === 'Adjustment' && change < 0) {
      // Negative adjustments = shrinkage/loss
      actualCost += Math.abs(change) * cost
    }
  }

  // Build daily trends
  const dailyMap = new Map<string, { theoretical: number; actual: number }>()

  for (const h of stockHistory) {
    const date = h.created_at.split('T')[0]
    const entry = dailyMap.get(date) || { theoretical: 0, actual: 0 }
    const change = Number(h.quantity_change || 0)
    const cost = costMap.get(h.inventory_item_id) || 0

    if (h.action_type === 'Sale') {
      entry.actual += Math.abs(change) * cost
    } else if (h.action_type === 'Waste') {
      entry.actual += Math.abs(change) * cost
    } else if (h.action_type === 'Adjustment' && change < 0) {
      entry.actual += Math.abs(change) * cost
    }

    dailyMap.set(date, entry)
  }

  const trends: FoodCostTrend[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date,
      theoretical: round(vals.theoretical),
      actual: round(vals.actual),
    }))

  return { actualCost: round(actualCost), trends }
}

/**
 * Get total waste cost attributed to inventory items in a date range
 */
async function getWasteCost(
  supabase: SupabaseClient,
  storeId: string,
  startDate: string,
  endDate: string
): Promise<{ total: number; byItem: Map<string, number> }> {
  const { data: wasteLogs } = await supabase
    .from('waste_log')
    .select('inventory_item_id, estimated_cost')
    .eq('store_id', storeId)
    .gte('reported_at', `${startDate}T00:00:00.000Z`)
    .lte('reported_at', `${endDate}T23:59:59.999Z`)

  const byItem = new Map<string, number>()
  let total = 0

  if (wasteLogs) {
    for (const w of wasteLogs) {
      const cost = Number(w.estimated_cost || 0)
      total += cost
      const current = byItem.get(w.inventory_item_id) || 0
      byItem.set(w.inventory_item_id, current + cost)
    }
  }

  return { total: round(total), byItem }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

// ── Main Report Function ──

export async function generateFoodCostReport(
  supabase: SupabaseClient,
  params: FoodCostParams
): Promise<FoodCostReport> {
  const { storeId, startDate, endDate, categoryId, menuItemId } = params

  // 1. Fetch menu items with recipes
  let menuQuery = supabase
    .from('menu_items')
    .select('id, name, category, selling_price, recipe_id, recipe:recipes(id, name, yield_quantity)')
    .eq('store_id', storeId)
    .eq('is_active', true)

  if (categoryId) {
    menuQuery = menuQuery.eq('category', categoryId)
  }
  if (menuItemId) {
    menuQuery = menuQuery.eq('id', menuItemId)
  }

  const [
    { data: menuItems },
    unitsSoldMap,
    cogsResult,
    wasteResult,
  ] = await Promise.all([
    menuQuery,
    getUnitsSoldByMenuItem(supabase, storeId, startDate, endDate),
    calculateActualCOGS(supabase, storeId, startDate, endDate),
    getWasteCost(supabase, storeId, startDate, endDate),
  ])

  const items: FoodCostItem[] = []

  // 2. Calculate theoretical cost per menu item
  for (const mi of (menuItems || [])) {
    const recipeRaw = mi.recipe as unknown
    const recipe = (Array.isArray(recipeRaw) ? recipeRaw[0] : recipeRaw) as { id: string; name: string; yield_quantity: number } | null
    if (!recipe || !mi.recipe_id) continue

    const theoreticalPerUnit = await calculateRecipeCost(
      supabase,
      storeId,
      mi.recipe_id,
      recipe.yield_quantity
    )

    // Look up POS sales for this menu item's recipe ingredients
    // We need to find how many units of this menu item were sold
    // This requires mapping from menu_item → recipe → ingredients → pos_item_mappings
    const { data: recipeIngredients } = await supabase
      .from('recipe_ingredients')
      .select('inventory_item_id')
      .eq('recipe_id', mi.recipe_id)

    // Estimate units sold: take the max units sold for any ingredient in this recipe
    // (best proxy when POS maps to inventory items, not menu items directly)
    let unitsSold = 0
    const ingredientItemIds = (recipeIngredients || []).map((ri: { inventory_item_id: string }) => ri.inventory_item_id)

    if (ingredientItemIds.length > 0) {
      // Check if any of the recipe's ingredients have POS sales
      for (const itemId of ingredientItemIds) {
        const sold = unitsSoldMap.get(itemId) || 0
        if (sold > unitsSold) unitsSold = sold
      }
    }

    const theoreticalTotal = round(theoreticalPerUnit * unitsSold)
    const sellingPrice = Number(mi.selling_price)
    const revenue = round(sellingPrice * unitsSold)

    // Attribute waste to this menu item's ingredients
    let wasteAttributed = 0
    for (const itemId of ingredientItemIds) {
      wasteAttributed += wasteResult.byItem.get(itemId) || 0
    }

    const foodCostPct = revenue > 0 ? round((theoreticalTotal / revenue) * 100) : 0

    items.push({
      menu_item_id: mi.id,
      name: mi.name,
      category: mi.category,
      units_sold: unitsSold,
      theoretical_cost_per_unit: round(theoreticalPerUnit),
      theoretical_cost_total: theoreticalTotal,
      waste_attributed: round(wasteAttributed),
      selling_price: sellingPrice,
      revenue,
      food_cost_pct: foodCostPct,
    })
  }

  // Sort by variance descending (highest cost items first)
  items.sort((a, b) => b.theoretical_cost_total - a.theoretical_cost_total)

  // 3. Category breakdown
  const categoryMap = new Map<string, FoodCostCategory>()
  for (const item of items) {
    const cat = item.category || 'Uncategorized'
    const existing = categoryMap.get(cat) || {
      category: cat,
      item_count: 0,
      theoretical_cost: 0,
      revenue: 0,
      food_cost_pct: 0,
    }
    existing.item_count += 1
    existing.theoretical_cost += item.theoretical_cost_total
    existing.revenue += item.revenue
    categoryMap.set(cat, existing)
  }

  const categories = Array.from(categoryMap.values()).map(cat => ({
    ...cat,
    theoretical_cost: round(cat.theoretical_cost),
    revenue: round(cat.revenue),
    food_cost_pct: cat.revenue > 0 ? round((cat.theoretical_cost / cat.revenue) * 100) : 0,
  }))

  // 4. Summary
  const theoreticalTotal = round(items.reduce((sum, i) => sum + i.theoretical_cost_total, 0))
  const totalRevenue = round(items.reduce((sum, i) => sum + i.revenue, 0))
  const actualCost = cogsResult.actualCost
  const variance = round(actualCost - theoreticalTotal)
  const variancePct = theoreticalTotal > 0 ? round((variance / theoreticalTotal) * 100) : 0
  const wasteCost = wasteResult.total
  const unaccountedVariance = round(variance - wasteCost)

  // Update trend data with theoretical costs per day (distribute proportionally)
  const trends = cogsResult.trends.map(t => ({
    ...t,
    theoretical: totalRevenue > 0
      ? round(theoreticalTotal * (t.actual / (actualCost || 1)))
      : 0,
  }))

  const summary: FoodCostSummary = {
    theoretical_cost: theoreticalTotal,
    actual_cost: actualCost,
    variance,
    variance_percentage: variancePct,
    total_revenue: totalRevenue,
    theoretical_food_cost_pct: totalRevenue > 0 ? round((theoreticalTotal / totalRevenue) * 100) : 0,
    actual_food_cost_pct: totalRevenue > 0 ? round((actualCost / totalRevenue) * 100) : 0,
    waste_cost: wasteCost,
    unaccounted_variance: unaccountedVariance,
    period_start: startDate,
    period_end: endDate,
  }

  return { summary, items, categories, trends }
}
