import { NextRequest } from 'next/server'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest, apiForbidden } from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { revokeXeroToken } from '@/lib/services/accounting/xero'
import { auditLog } from '@/lib/audit'
import type { AccountingCredentials } from '@/lib/services/accounting/types'

/**
 * POST /api/integrations/xero/disconnect
 * Disconnect Xero — revoke token and deactivate connection.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })
    if (!auth.success) return auth.response
    const { context } = auth

    const body = await request.json()
    const storeId = body.store_id

    if (!storeId) {
      return apiBadRequest('store_id is required', context.requestId)
    }

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const supabase = createAdminClient()

    // Get current connection
    const { data: connection } = await supabase
      .from('accounting_connections')
      .select('*')
      .eq('store_id', storeId)
      .eq('provider', 'xero')
      .single()

    if (!connection) {
      return apiBadRequest('No Xero connection found', context.requestId)
    }

    // Revoke token (best effort)
    const credentials = connection.credentials as unknown as AccountingCredentials
    await revokeXeroToken(credentials)

    // Deactivate connection (keep record for sync history)
    await supabase
      .from('accounting_connections')
      .update({
        is_active: false,
        credentials: {},
        sync_status: 'idle',
      })
      .eq('id', connection.id)

    await auditLog(supabase, {
      userId: context.user.id,
      storeId,
      action: 'xero.disconnected',
      details: {},
    })

    return apiSuccess({ disconnected: true }, { requestId: context.requestId })
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'Failed to disconnect Xero',
      { status: 500 }
    )
  }
}
