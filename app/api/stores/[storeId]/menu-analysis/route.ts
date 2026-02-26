import { NextRequest } from 'next/server'
import { withApiAuth, canAccessStore } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiForbidden,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { convertQuantity } from '@/lib/utils/units'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * GET /api/stores/:storeId/menu-analysis - Menu profitability analysis
 *
 * Returns comprehensive menu analytics:
 *   - Overall stats (avg food cost %, total items, profitable/unprofitable counts)
 *   - Per-item breakdown with food cost, margin, and profitability rating
 *   - Category-level analysis
 *   - Cost alerts (items above target food cost %)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canAccessStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const searchParams = request.nextUrl.searchParams
    const targetFoodCostPct = Number(searchParams.get('targetFoodCost') || 30)

    // Fetch all active menu items with recipes
    const { data: menuItems, error } = await context.supabase
      .from('menu_items')
      .select('*, recipe:recipes(id, name, yield_quantity)')
      .eq('store_id', storeId)
      .eq('is_active', true)

    if (error) {
      return apiError('Failed to fetch menu data')
    }

    const items = menuItems || []

    // Calculate costs for each menu item
    const analysisItems = await Promise.all(
      items.map(async (item: {
        id: string
        name: string
        category: string | null
        selling_price: number
        recipe_id: string | null
        recipe: { id: string; name: string; yield_quantity: number } | null
      }) => {
        let foodCost = 0

        if (item.recipe_id && item.recipe) {
          const { data: ingredients } = await context.supabase
            .from('recipe_ingredients')
            .select('quantity, inventory_item_id, unit_of_measure')
            .eq('recipe_id', item.recipe_id)

          if (ingredients && ingredients.length > 0) {
            const itemIds = ingredients.map((i: { inventory_item_id: string }) => i.inventory_item_id)

            // Fetch unit costs and inventory unit_of_measure for conversion
            const { data: inventoryData } = await context.supabase
              .from('store_inventory')
              .select('inventory_item_id, unit_cost')
              .eq('store_id', storeId)
              .in('inventory_item_id', itemIds)

            const { data: itemData } = await context.supabase
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

                // Convert recipe quantity to inventory units for accurate cost
                const convertedQty = convertQuantity(Number(ing.quantity), recipeUnit, inventoryUnit)
                const effectiveQty = convertedQty !== null ? convertedQty : Number(ing.quantity)

                return sum + (effectiveQty * unitCost)
              },
              0
            )

            foodCost = item.recipe.yield_quantity > 0
              ? totalCost / item.recipe.yield_quantity
              : totalCost
          }
        }

        const sellingPrice = Number(item.selling_price)
        const foodCostPct = sellingPrice > 0
          ? (foodCost / sellingPrice) * 100
          : 0
        const profitMargin = sellingPrice - foodCost

        let rating: 'excellent' | 'good' | 'fair' | 'poor' | 'no_recipe'
        if (!item.recipe_id) {
          rating = 'no_recipe'
        } else if (foodCostPct <= targetFoodCostPct * 0.8) {
          rating = 'excellent'
        } else if (foodCostPct <= targetFoodCostPct) {
          rating = 'good'
        } else if (foodCostPct <= targetFoodCostPct * 1.2) {
          rating = 'fair'
        } else {
          rating = 'poor'
        }

        return {
          id: item.id,
          name: item.name,
          category: item.category,
          selling_price: sellingPrice,
          food_cost: Math.round(foodCost * 100) / 100,
          food_cost_percentage: Math.round(foodCostPct * 100) / 100,
          profit_margin: Math.round(profitMargin * 100) / 100,
          has_recipe: !!item.recipe_id,
          recipe_name: item.recipe?.name || null,
          rating,
        }
      })
    )

    // Calculate summary stats
    const itemsWithRecipe = analysisItems.filter(i => i.has_recipe)
    const avgFoodCostPct = itemsWithRecipe.length > 0
      ? itemsWithRecipe.reduce((sum, i) => sum + i.food_cost_percentage, 0) / itemsWithRecipe.length
      : 0

    const totalRevenuePotential = analysisItems.reduce((sum, i) => sum + i.selling_price, 0)
    const totalFoodCost = analysisItems.reduce((sum, i) => sum + i.food_cost, 0)
    const totalProfit = analysisItems.reduce((sum, i) => sum + i.profit_margin, 0)

    // Category breakdown
    const categoryMap = new Map<string, {
      category: string
      item_count: number
      avg_food_cost_pct: number
      total_revenue: number
      total_cost: number
      total_profit: number
    }>()

    for (const item of analysisItems) {
      const cat = item.category || 'Uncategorized'
      const existing = categoryMap.get(cat) || {
        category: cat,
        item_count: 0,
        avg_food_cost_pct: 0,
        total_revenue: 0,
        total_cost: 0,
        total_profit: 0,
      }
      existing.item_count += 1
      existing.total_revenue += item.selling_price
      existing.total_cost += item.food_cost
      existing.total_profit += item.profit_margin
      categoryMap.set(cat, existing)
    }

    const categories = Array.from(categoryMap.values()).map(cat => ({
      ...cat,
      avg_food_cost_pct: cat.total_revenue > 0
        ? Math.round((cat.total_cost / cat.total_revenue) * 10000) / 100
        : 0,
      total_revenue: Math.round(cat.total_revenue * 100) / 100,
      total_cost: Math.round(cat.total_cost * 100) / 100,
      total_profit: Math.round(cat.total_profit * 100) / 100,
    }))

    // Cost alerts
    const costAlerts = analysisItems
      .filter(i => i.has_recipe && i.food_cost_percentage > targetFoodCostPct)
      .sort((a, b) => b.food_cost_percentage - a.food_cost_percentage)

    // Rating distribution
    const ratingCounts = {
      excellent: analysisItems.filter(i => i.rating === 'excellent').length,
      good: analysisItems.filter(i => i.rating === 'good').length,
      fair: analysisItems.filter(i => i.rating === 'fair').length,
      poor: analysisItems.filter(i => i.rating === 'poor').length,
      no_recipe: analysisItems.filter(i => i.rating === 'no_recipe').length,
    }

    return apiSuccess(
      {
        summary: {
          total_menu_items: items.length,
          items_with_recipe: itemsWithRecipe.length,
          items_without_recipe: items.length - itemsWithRecipe.length,
          average_food_cost_percentage: Math.round(avgFoodCostPct * 100) / 100,
          target_food_cost_percentage: targetFoodCostPct,
          total_revenue_potential: Math.round(totalRevenuePotential * 100) / 100,
          total_food_cost: Math.round(totalFoodCost * 100) / 100,
          total_profit: Math.round(totalProfit * 100) / 100,
          rating_distribution: ratingCounts,
        },
        items: analysisItems,
        categories,
        cost_alerts: costAlerts,
      },
      { requestId: context.requestId }
    )
  } catch (error) {
    logger.error('Error fetching menu analysis:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to fetch menu analysis')
  }
}
