import { NextRequest } from 'next/server'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest, apiForbidden } from '@/lib/api/response'

type RouteParams = { params: Promise<{ storeId: string }> }

/**
 * GET /api/stores/[storeId]/pos/events - List recent POS sale events
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

    if (!canManageStore(context, storeId)) {
      return apiForbidden('Access denied', context.requestId)
    }

    const searchParams = request.nextUrl.searchParams
    const connectionId = searchParams.get('connectionId')
    const status = searchParams.get('status')
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))

    let query = context.supabase
      .from('pos_sale_events')
      .select('id, external_event_id, event_type, items, total_amount, currency, occurred_at, processed_at, status, error_message, created_at')
      .eq('store_id', storeId)
      .order('occurred_at', { ascending: false })
      .limit(limit)

    if (connectionId) {
      query = query.eq('pos_connection_id', connectionId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    return apiSuccess(data ?? [], { requestId: context.requestId })
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Failed to fetch POS events')
  }
}
