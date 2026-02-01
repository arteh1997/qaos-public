import { NextRequest } from 'next/server'
import { withApiAuth, canAccessStore, parsePaginationParams } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiForbidden,
  createPaginationMeta,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { StockHistory } from '@/types'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * GET /api/stores/:storeId/history - Get stock history for a store
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
    const actionType = searchParams.get('action_type')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Check store access (uses store_users membership)
    if (!canAccessStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    // Build query
    let query = context.supabase
      .from('stock_history')
      .select(`
        *,
        inventory_item:inventory_items(*),
        performer:profiles(id, full_name, email)
      `, { count: 'exact' })
      .eq('store_id', storeId)

    // Filter by action type
    if (actionType && ['Count', 'Reception', 'Adjustment'].includes(actionType)) {
      query = query.eq('action_type', actionType)
    }

    // Filter by date range
    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00.000Z`)
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59.999Z`)
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    return apiSuccess(data as StockHistory[], {
      requestId: context.requestId,
      pagination: createPaginationMeta(page, pageSize, count ?? 0),
    })
  } catch (error) {
    console.error('Error getting stock history:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to get stock history')
  }
}
