import { NextRequest } from 'next/server'
import { withApiAuth, canAccessStore, parsePaginationParams } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiForbidden,
  createPaginationMeta,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { StoreInventory } from '@/types'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * GET /api/stores/:storeId/inventory - Get store inventory
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params

    const auth = await withApiAuth(request, {
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth
    const { page, pageSize, from, to } = parsePaginationParams(request)
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')
    const lowStock = searchParams.get('low_stock') === 'true'

    // Check store access (uses store_users membership)
    if (!canAccessStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    // Build query
    let query = context.supabase
      .from('store_inventory')
      .select(`
        *,
        inventory_item:inventory_items(*)
      `, { count: 'exact' })
      .eq('store_id', storeId)

    // Filter by category
    if (category) {
      query = query.eq('inventory_item.category', category)
    }

    // Filter low stock items
    if (lowStock) {
      query = query.not('par_level', 'is', null)
    }

    const { data, error, count } = await query.range(from, to)

    if (error) throw error

    // Post-filter for low stock (since we need to compare quantity to par_level)
    let inventory = data as StoreInventory[]
    if (lowStock) {
      inventory = inventory.filter(item =>
        item.par_level !== null && item.quantity < item.par_level
      )
    }

    return apiSuccess(inventory, {
      requestId: context.requestId,
      pagination: createPaginationMeta(page, pageSize, count ?? 0),
    })
  } catch (error) {
    logger.error('Error getting store inventory:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to get inventory')
  }
}
