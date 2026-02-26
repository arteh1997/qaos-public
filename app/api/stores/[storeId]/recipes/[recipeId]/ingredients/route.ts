import { NextRequest } from 'next/server'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { recipeIngredientSchema } from '@/lib/validations/recipes'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string; recipeId: string }>
}

/**
 * POST /api/stores/:storeId/recipes/:recipeId/ingredients - Add ingredient to recipe
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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
      return apiForbidden('You do not have permission to modify recipes', context.requestId)
    }

    // Verify recipe belongs to store
    const { data: recipe } = await context.supabase
      .from('recipes')
      .select('id')
      .eq('id', recipeId)
      .eq('store_id', storeId)
      .single()

    if (!recipe) {
      return apiBadRequest('Recipe not found in this store', context.requestId)
    }

    const body = await request.json()
    const validation = recipeIngredientSchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const { data, error } = await context.supabase
      .from('recipe_ingredients')
      .insert({
        recipe_id: recipeId,
        ...validation.data,
      })
      .select('*, inventory_item:inventory_items(id, name, category, unit_of_measure)')
      .single()

    if (error) {
      if (error.code === '23505') {
        return apiBadRequest('This ingredient is already in the recipe', context.requestId)
      }
      return apiError('Failed to add ingredient')
    }

    const admin = createAdminClient()
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'inventory.recipe_ingredient_add',
      storeId,
      resourceType: 'recipe_ingredient',
      resourceId: data.id,
      details: {
        recipeId,
        ingredientName: data.inventory_item?.name || validation.data.inventory_item_id,
        quantity: validation.data.quantity,
        unitOfMeasure: validation.data.unit_of_measure,
      },
      request,
    })

    return apiSuccess(data, { requestId: context.requestId, status: 201 })
  } catch (error) {
    logger.error('Error adding ingredient:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to add ingredient')
  }
}

/**
 * DELETE /api/stores/:storeId/recipes/:recipeId/ingredients - Remove ingredient
 *
 * Query params: ingredientId (the recipe_ingredient id to remove)
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
      return apiForbidden('You do not have permission to modify recipes', context.requestId)
    }

    const ingredientId = request.nextUrl.searchParams.get('ingredientId')
    if (!ingredientId) {
      return apiBadRequest('ingredientId is required', context.requestId)
    }

    // Verify recipe belongs to store
    const { data: recipe } = await context.supabase
      .from('recipes')
      .select('id')
      .eq('id', recipeId)
      .eq('store_id', storeId)
      .single()

    if (!recipe) {
      return apiBadRequest('Recipe not found in this store', context.requestId)
    }

    const { error } = await context.supabase
      .from('recipe_ingredients')
      .delete()
      .eq('id', ingredientId)
      .eq('recipe_id', recipeId)

    if (error) {
      return apiError('Failed to remove ingredient')
    }

    const admin = createAdminClient()
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'inventory.recipe_ingredient_remove',
      storeId,
      resourceType: 'recipe_ingredient',
      resourceId: ingredientId,
      details: { recipeId, ingredientId },
      request,
    })

    return apiSuccess({ message: 'Ingredient removed successfully' }, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error removing ingredient:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to remove ingredient')
  }
}
