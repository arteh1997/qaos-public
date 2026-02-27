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

    // Low stock: use server-side RPC for accurate pagination
    if (lowStock) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcData, error: rpcError } = await (context.supabase as any)
        .rpc('get_low_stock_inventory', {
          p_store_id: storeId,
          p_category: category || null,
          p_limit: pageSize,
          p_offset: from,
        })

      if (rpcError) throw rpcError

      const rows = rpcData ?? []
      const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0

      // Transform RPC rows to match expected inventory shape
      const inventory = rows.map((row: Record<string, unknown>) => ({
        store_id: row.store_id,
        inventory_item_id: row.inventory_item_id,
        quantity: row.quantity,
        par_level: row.par_level,
        last_updated_at: row.last_updated_at,
        last_updated_by: row.last_updated_by,
        inventory_item: {
          id: row.item_id,
          name: row.item_name,
          category: row.item_category,
          unit_of_measure: row.item_unit_of_measure,
          sku: row.item_sku,
        },
      }))

      return apiSuccess(inventory, {
        requestId: context.requestId,
        pagination: createPaginationMeta(page, pageSize, totalCount),
      })
    }

    // Standard query: all inventory items (explicit columns to avoid over-fetching)
    let query = context.supabase
      .from('store_inventory')
      .select(`
        id, store_id, inventory_item_id, quantity, par_level, unit_cost, cost_currency, last_updated_at, last_updated_by,
        inventory_item:inventory_items(id, name, category, category_id, unit_of_measure, is_active)
      `, { count: 'exact' })
      .eq('store_id', storeId)

    if (category) {
      query = query.eq('inventory_item.category', category)
    }

    const { data, error, count } = await query.range(from, to)

    if (error) throw error

    const inventory = data as StoreInventory[]

    return apiSuccess(inventory, {
      requestId: context.requestId,
      pagination: createPaginationMeta(page, pageSize, count ?? 0),
    })
  } catch (error) {
    logger.error('Error getting store inventory:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to get inventory')
  }
}
