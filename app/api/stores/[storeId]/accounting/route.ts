import { NextRequest } from 'next/server'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiForbidden } from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * GET /api/stores/:storeId/accounting
 * Get accounting connection status for this store (Xero and/or QuickBooks).
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
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const supabase = createAdminClient()

    const { data: connections, error } = await supabase
      .from('accounting_connections')
      .select('id, store_id, provider, is_active, last_synced_at, sync_status, sync_error, config, created_at, updated_at')
      .eq('store_id', storeId)

    if (error) {
      return apiError('Failed to fetch accounting connections', {
        status: 500,
        requestId: context.requestId,
      })
    }

    // Get recent sync log entries
    const connectionIds = (connections || []).map(c => c.id)
    let recentSyncs: Record<string, unknown>[] = []

    if (connectionIds.length > 0) {
      const { data: syncs } = await supabase
        .from('accounting_sync_log')
        .select('*')
        .in('connection_id', connectionIds)
        .order('created_at', { ascending: false })
        .limit(10)

      recentSyncs = syncs || []
    }

    return apiSuccess(
      {
        connections: (connections || []).map(conn => ({
          ...conn,
          // Never expose credentials to the client
          credentials: undefined,
        })),
        recent_syncs: recentSyncs,
      },
      { requestId: context.requestId }
    )
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'Failed to fetch accounting status',
      { status: 500 }
    )
  }
}
