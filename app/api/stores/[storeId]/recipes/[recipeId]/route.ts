import { NextRequest } from 'next/server'
import { withApiAuth, canAccessStore, canManageStore } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
  apiNotFound,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { updateRecipeSchema } from '@/lib/validations/recipes'
import { convertQuantity, normalizeUnit } from '@/lib/utils/units'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog, computeFieldChanges } from '@/lib/audit'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string; recipeId: string }>
}

/**
 * GET /api/stores/:storeId/recipes/:recipeId - Get recipe detail with cost breakdown
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, recipeId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager', 'Staff'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canAccessStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    // Fetch recipe
    const { data: recipe, error } = await context.supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .eq('store_id', storeId)
      .single()

    if (error || !recipe) {
      return apiNotFound('Recipe', context.requestId)
    }

    // Fetch ingredients with inventory item details (only active items)
    const { data: ingredients } = await context.supabase
      .from('recipe_ingredients')
      .select('*, inventory_item:inventory_items!inner(id, name, category, unit_of_measure)')
      .eq('recipe_id', recipeId)
      .eq('inventory_item.is_active', true)

    // Get unit costs from store_inventory
    const itemIds = (ingredients || []).map((i: { inventory_item_id: string }) => i.inventory_item_id)

    let costMap = new Map<string, number>()
    if (itemIds.length > 0) {
      const { data: inventoryData } = await context.supabase
        .from('store_inventory')
        .select('inventory_item_id, unit_cost')
        .eq('store_id', storeId)
        .in('inventory_item_id', itemIds)

      costMap = new Map(
        (inventoryData || []).map((item: { inventory_item_id: string; unit_cost: number }) => [
          item.inventory_item_id,
          Number(item.unit_cost || 0),
        ])
      )
    }

    // Calculate per-ingredient costs with unit conversion
    const ingredientsWithCosts = (ingredients || []).map((ing: {
      inventory_item_id: string
      quantity: number
      unit_of_measure: string
      notes: string | null
      inventory_item: { id: string; name: string; category: string | null; unit_of_measure: string } | null
    }) => {
      const unitCost = costMap.get(ing.inventory_item_id) || 0
      const recipeUnit = ing.unit_of_measure || ''
      const inventoryUnit = ing.inventory_item?.unit_of_measure || ''

      // Convert recipe quantity to inventory units for accurate cost calculation
      const convertedQty = convertQuantity(Number(ing.quantity), recipeUnit, inventoryUnit)
      const effectiveQty = convertedQty !== null ? convertedQty : Number(ing.quantity)
      const lineCost = effectiveQty * unitCost

      return {
        ...ing,
        unit_cost: Math.round(unitCost * 100) / 100,
        line_cost: Math.round(lineCost * 100) / 100,
        unit_mismatch: convertedQty === null && normalizeUnit(recipeUnit) !== normalizeUnit(inventoryUnit),
      }
    })

    const totalCost = ingredientsWithCosts.reduce(
      (sum: number, ing: { line_cost: number }) => sum + ing.line_cost,
      0
    )

    return apiSuccess(
      {
        ...recipe,
        ingredients: ingredientsWithCosts,
        total_cost: Math.round(totalCost * 100) / 100,
        cost_per_unit: recipe.yield_quantity > 0
          ? Math.round((totalCost / recipe.yield_quantity) * 100) / 100
          : 0,
      },
      { requestId: context.requestId }
    )
  } catch (error) {
    logger.error('Error fetching recipe:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to fetch recipe')
  }
}

/**
 * PUT /api/stores/:storeId/recipes/:recipeId - Update a recipe
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, recipeId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to update recipes', context.requestId)
    }

    const body = await request.json()
    const validation = updateRecipeSchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    // Fetch current state for before/after tracking
    const { data: beforeRecipe } = await context.supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .eq('store_id', storeId)
      .single()

    const { data, error } = await context.supabase
      .from('recipes')
      .update(validation.data)
      .eq('id', recipeId)
      .eq('store_id', storeId)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return apiBadRequest('A recipe with this name already exists', context.requestId)
      }
      return apiError('Failed to update recipe')
    }

    if (!data) {
      return apiNotFound('Recipe', context.requestId)
    }

    const admin = createAdminClient()
    const fieldChanges = beforeRecipe
      ? computeFieldChanges(beforeRecipe, validation.data)
      : []
    void auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'inventory.recipe_update',
      storeId,
      resourceType: 'recipe',
      resourceId: recipeId,
      details: { recipeName: data.name, updatedFields: Object.keys(validation.data), fieldChanges },
      request,
    }).catch(err => logger.error('Audit log error:', { error: err }))

    return apiSuccess(data, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error updating recipe:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to update recipe')
  }
}

/**
 * DELETE /api/stores/:storeId/recipes/:recipeId - Delete a recipe
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, recipeId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to delete recipes', context.requestId)
    }

    // Fetch recipe name before deleting for audit log
    const { data: recipeToDelete } = await context.supabase
      .from('recipes')
      .select('name')
      .eq('id', recipeId)
      .eq('store_id', storeId)
      .single()

    const { error } = await context.supabase
      .from('recipes')
      .delete()
      .eq('id', recipeId)
      .eq('store_id', storeId)

    if (error) {
      return apiError('Failed to delete recipe')
    }

    const admin = createAdminClient()
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'inventory.recipe_delete',
      storeId,
      resourceType: 'recipe',
      resourceId: recipeId,
      details: { recipeName: recipeToDelete?.name || recipeId },
      request,
    })

    return apiSuccess({ message: 'Recipe deleted successfully' }, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error deleting recipe:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to delete recipe')
  }
}
