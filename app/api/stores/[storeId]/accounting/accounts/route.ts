import { NextRequest } from 'next/server'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest, apiForbidden } from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { xeroAdapter } from '@/lib/services/accounting/xero'
import { getXeroCredentials } from '@/lib/services/accounting/xero'
import type { AccountingCredentials } from '@/lib/services/accounting/types'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * GET /api/stores/:storeId/accounting/accounts
 * Fetch chart of accounts from the connected accounting provider.
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

    const { searchParams } = new URL(request.url)
    const provider = searchParams.get('provider') || 'xero'

    const supabase = createAdminClient()

    const { data: connection } = await supabase
      .from('accounting_connections')
      .select('*')
      .eq('store_id', storeId)
      .eq('provider', provider)
      .eq('is_active', true)
      .single()

    if (!connection) {
      return apiBadRequest(`No active ${provider} connection found`, context.requestId)
    }

    const rawCredentials = connection.credentials as unknown as AccountingCredentials

    // Auto-refresh token if needed
    const credentials = await getXeroCredentials(connection.id, rawCredentials)

    // Fetch accounts from provider
    const accounts = await xeroAdapter.getAccounts(credentials)

    // Filter to expense accounts (most relevant for mapping)
    const expenseAccounts = accounts.filter(
      a => a.class === 'EXPENSE' && a.status === 'ACTIVE'
    )

    return apiSuccess(
      {
        accounts: expenseAccounts,
        all_accounts: accounts.filter(a => a.status === 'ACTIVE'),
      },
      { requestId: context.requestId }
    )
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'Failed to fetch accounts',
      { status: 500 }
    )
  }
}
