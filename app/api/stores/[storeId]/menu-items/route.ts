import { NextRequest } from 'next/server'
import { withApiAuth, canAccessStore, canManageStore, parsePaginationParams } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
  createPaginationMeta,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { createMenuItemSchema } from '@/lib/validations/recipes'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * GET /api/stores/:storeId/menu-items - List menu items with cost data
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

    const { page, pageSize, from, to } = parsePaginationParams(request)

    const { data, error, count } = await context.supabase
      .from('menu_items')
      .select('*, recipe:recipes(id, name, yield_quantity, yield_unit)', { count: 'exact' })
      .eq('store_id', storeId)
      .order('name', { ascending: true })
      .range(from, to)

    if (error) {
      return apiError('Failed to fetch menu items')
    }

    // Batch-fetch all recipe ingredients in one query (avoids N+1)
    const recipeIds = (data || [])
      .filter((item: { recipe_id: string | null }) => item.recipe_id)
      .map((item: { recipe_id: string | null }) => item.recipe_id as string)

    const { data: allIngredients } = recipeIds.length > 0
      ? await context.supabase
          .from('recipe_ingredients')
          .select('recipe_id, quantity, inventory_item_id')
          .in('recipe_id', recipeIds)
      : { data: [] }

    // Group ingredients by recipe_id
    const ingredientsByRecipe = new Map<string, Array<{ inventory_item_id: string; quantity: number }>>()
    for (const ing of (allIngredients || []) as Array<{ recipe_id: string; inventory_item_id: string; quantity: number }>) {
      const list = ingredientsByRecipe.get(ing.recipe_id) || []
      list.push(ing)
      ingredientsByRecipe.set(ing.recipe_id, list)
    }

    // Batch-fetch all unit costs in one query
    const allItemIds = [...new Set((allIngredients || []).map((i: { inventory_item_id: string }) => i.inventory_item_id))]

    const { data: inventoryData } = allItemIds.length > 0
      ? await context.supabase
          .from('store_inventory')
          .select('inventory_item_id, unit_cost')
          .eq('store_id', storeId)
          .in('inventory_item_id', allItemIds)
      : { data: [] }

    const costMap = new Map(
      (inventoryData || []).map((inv: { inventory_item_id: string; unit_cost: number }) => [
        inv.inventory_item_id,
        Number(inv.unit_cost || 0),
      ])
    )

    // Assemble response (no additional queries needed)
    const menuItemsWithCosts = (data || []).map((item: {
      recipe_id: string | null
      selling_price: number
      recipe: { id: string; yield_quantity: number } | null
    }) => {
      let foodCost = 0

      if (item.recipe_id && item.recipe) {
        const ingredients = ingredientsByRecipe.get(item.recipe_id) || []
        const totalRecipeCost = ingredients.reduce(
          (sum: number, ing) => sum + (Number(ing.quantity) * (costMap.get(ing.inventory_item_id) || 0)),
          0
        )
        foodCost = item.recipe.yield_quantity > 0
          ? totalRecipeCost / item.recipe.yield_quantity
          : totalRecipeCost
      }

      const sellingPrice = Number(item.selling_price)
      const foodCostPercentage = sellingPrice > 0
        ? Math.round((foodCost / sellingPrice) * 10000) / 100
        : 0
      const profitMargin = sellingPrice - foodCost

      return {
        ...item,
        food_cost: Math.round(foodCost * 100) / 100,
        food_cost_percentage: foodCostPercentage,
        profit_margin: Math.round(profitMargin * 100) / 100,
      }
    })

    const pagination = createPaginationMeta(page, pageSize, count ?? 0)

    return apiSuccess(menuItemsWithCosts, {
      requestId: context.requestId,
      pagination,
    })
  } catch (error) {
    logger.error('Error fetching menu items:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to fetch menu items')
  }
}

/**
 * POST /api/stores/:storeId/menu-items - Create a menu item
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to create menu items', context.requestId)
    }

    const body = await request.json()
    const validation = createMenuItemSchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    // If recipe_id provided, verify it belongs to this store
    if (validation.data.recipe_id) {
      const { data: recipe } = await context.supabase
        .from('recipes')
        .select('id')
        .eq('id', validation.data.recipe_id)
        .eq('store_id', storeId)
        .single()

      if (!recipe) {
        return apiBadRequest('Recipe not found in this store', context.requestId)
      }
    }

    const { data, error } = await context.supabase
      .from('menu_items')
      .insert({
        store_id: storeId,
        ...validation.data,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return apiBadRequest('A menu item with this name already exists', context.requestId)
      }
      return apiError('Failed to create menu item')
    }

    const admin = createAdminClient()
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'inventory.menu_item_create',
      storeId,
      resourceType: 'menu_item',
      resourceId: data.id,
      details: { menuItemName: data.name, sellingPrice: data.selling_price },
      request,
    })

    return apiSuccess(data, { requestId: context.requestId, status: 201 })
  } catch (error) {
    logger.error('Error creating menu item:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to create menu item')
  }
}
