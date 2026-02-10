import { NextRequest } from 'next/server'
import { withApiAuth, canAccessStore, canManageStore } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
  createPaginationMeta,
} from '@/lib/api/response'
import { parsePaginationParams } from '@/lib/api/middleware'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { createRecipeSchema } from '@/lib/validations/recipes'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * GET /api/stores/:storeId/recipes - List recipes
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager', 'Staff'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canAccessStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const { page, pageSize, from, to } = parsePaginationParams(request)
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')
    const active = searchParams.get('active')

    let query = context.supabase
      .from('recipes')
      .select('*', { count: 'exact' })
      .eq('store_id', storeId)
      .order('name', { ascending: true })

    if (category) {
      query = query.eq('category', category)
    }

    if (active !== null && active !== undefined) {
      query = query.eq('is_active', active === 'true')
    }

    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      return apiError('Failed to fetch recipes')
    }

    // For each recipe, calculate total cost from ingredients
    const recipesWithCosts = await Promise.all(
      (data || []).map(async (recipe: { id: string; yield_quantity: number }) => {
        const { data: ingredients } = await context.supabase
          .from('recipe_ingredients')
          .select('quantity, unit_of_measure, inventory_item_id')
          .eq('recipe_id', recipe.id)

        // Get unit costs for ingredients from store_inventory
        let totalCost = 0
        if (ingredients && ingredients.length > 0) {
          const itemIds = ingredients.map((i: { inventory_item_id: string }) => i.inventory_item_id)
          const { data: inventoryData } = await context.supabase
            .from('store_inventory')
            .select('inventory_item_id, unit_cost')
            .eq('store_id', storeId)
            .in('inventory_item_id', itemIds)

          const costMap = new Map(
            (inventoryData || []).map((item: { inventory_item_id: string; unit_cost: number }) => [
              item.inventory_item_id,
              Number(item.unit_cost || 0),
            ])
          )

          totalCost = ingredients.reduce((sum: number, ing: { inventory_item_id: string; quantity: number }) => {
            return sum + (Number(ing.quantity) * (costMap.get(ing.inventory_item_id) || 0))
          }, 0)
        }

        return {
          ...recipe,
          total_cost: Math.round(totalCost * 100) / 100,
          cost_per_unit: recipe.yield_quantity > 0
            ? Math.round((totalCost / recipe.yield_quantity) * 100) / 100
            : 0,
          ingredient_count: ingredients?.length || 0,
        }
      })
    )

    const pagination = createPaginationMeta(page, pageSize, count ?? 0)

    return apiSuccess(recipesWithCosts, {
      requestId: context.requestId,
      pagination,
    })
  } catch (error) {
    console.error('Error fetching recipes:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to fetch recipes')
  }
}

/**
 * POST /api/stores/:storeId/recipes - Create a recipe
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
      return apiForbidden('You do not have permission to create recipes', context.requestId)
    }

    const body = await request.json()
    const validation = createRecipeSchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const { data, error } = await context.supabase
      .from('recipes')
      .insert({
        store_id: storeId,
        ...validation.data,
        created_by: context.user.id,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return apiBadRequest('A recipe with this name already exists', context.requestId)
      }
      return apiError('Failed to create recipe')
    }

    return apiSuccess(data, { requestId: context.requestId, status: 201 })
  } catch (error) {
    console.error('Error creating recipe:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to create recipe')
  }
}
