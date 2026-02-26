import { NextRequest } from 'next/server'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest, apiForbidden } from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { glMappingSchema } from '@/lib/validations/accounting'
import { auditLog } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * GET /api/stores/:storeId/accounting/config
 * Get the GL mapping configuration for this store's accounting connection.
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
      .select('id, config')
      .eq('store_id', storeId)
      .eq('provider', provider)
      .single()

    if (!connection) {
      return apiBadRequest(`No ${provider} connection found`, context.requestId)
    }

    return apiSuccess(connection.config || {}, { requestId: context.requestId })
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'Failed to fetch config',
      { status: 500 }
    )
  }
}

/**
 * PUT /api/stores/:storeId/accounting/config
 * Update GL mapping configuration.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const body = await request.json()
    const parsed = glMappingSchema.safeParse(body)
    if (!parsed.success) {
      return apiBadRequest(
        `Invalid config: ${parsed.error.issues.map(i => i.message).join(', ')}`,
        context.requestId
      )
    }

    const { searchParams } = new URL(request.url)
    const provider = searchParams.get('provider') || 'xero'

    const supabase = createAdminClient()

    const { data: connection } = await supabase
      .from('accounting_connections')
      .select('id, config')
      .eq('store_id', storeId)
      .eq('provider', provider)
      .single()

    if (!connection) {
      return apiBadRequest(`No ${provider} connection found`, context.requestId)
    }

    // Merge new config with existing
    const existingConfig = (connection.config || {}) as Record<string, unknown>
    const newConfig = { ...existingConfig, ...parsed.data }

    const { error: updateError } = await supabase
      .from('accounting_connections')
      .update({ config: newConfig })
      .eq('id', connection.id)

    if (updateError) {
      return apiError('Failed to update config', {
        status: 500,
        requestId: context.requestId,
      })
    }

    await auditLog(supabase, {
      userId: context.user.id,
      storeId,
      action: 'accounting.config_updated',
      details: { provider, config: parsed.data },
    })

    return apiSuccess(newConfig, { requestId: context.requestId })
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'Failed to update config',
      { status: 500 }
    )
  }
}
