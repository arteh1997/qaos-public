import { NextRequest } from 'next/server'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { withApiAuth, canAccessStore, parsePaginationParams } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiForbidden } from '@/lib/api/response'
import { logger } from '@/lib/logger'

/**
 * GET /api/stores/[storeId]/alert-history
 * Returns the current user's alert history for this store
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  try {
    const { storeId } = await params
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth

    if (!canAccessStore(context, storeId)) {
      return apiForbidden('Access denied to this store', context.requestId)
    }

    const { from, to } = parsePaginationParams(request, { pageSize: 20 })

    const { data, error, count } = await context.supabase
      .from('alert_history')
      .select('*', { count: 'exact' })
      .eq('store_id', storeId)
      .eq('user_id', context.user.id)
      .order('sent_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    return apiSuccess({
      alerts: data ?? [],
      total: count ?? 0,
    }, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error fetching alert history:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to fetch alert history')
  }
}
