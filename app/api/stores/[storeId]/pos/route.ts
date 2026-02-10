import { NextRequest } from 'next/server'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest, apiForbidden } from '@/lib/api/response'
import { POS_PROVIDERS } from '@/lib/services/pos'
import { auditLog } from '@/lib/audit'

type RouteParams = { params: Promise<{ storeId: string }> }

/**
 * GET /api/stores/[storeId]/pos - List POS connections for a store
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

    const { data, error } = await context.supabase
      .from('pos_connections')
      .select('id, provider, name, is_active, last_synced_at, sync_status, sync_error, created_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return apiSuccess(data ?? [], { requestId: context.requestId })
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Failed to fetch POS connections')
  }
}

/**
 * POST /api/stores/[storeId]/pos - Create a POS connection
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('Only store owners can create POS connections', context.requestId)
    }

    const body = await request.json()
    const { provider, name, credentials, config } = body

    if (!provider || !Object.keys(POS_PROVIDERS).includes(provider)) {
      return apiBadRequest(
        `Invalid provider. Valid providers: ${Object.keys(POS_PROVIDERS).join(', ')}`,
        context.requestId
      )
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return apiBadRequest('name is required', context.requestId)
    }

    const { data, error } = await context.supabase
      .from('pos_connections')
      .insert({
        store_id: storeId,
        provider,
        name: name.trim(),
        credentials: credentials ?? {},
        config: config ?? {},
        created_by: context.user.id,
      })
      .select('id, provider, name, is_active, sync_status, created_at')
      .single()

    if (error) throw error

    await auditLog(context.supabase, {
      userId: context.user.id,
      storeId,
      action: 'settings.update',
      details: { action: 'pos_connection_created', provider, name },
    })

    return apiSuccess(data, { requestId: context.requestId, status: 201 })
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Failed to create POS connection')
  }
}

/**
 * DELETE /api/stores/[storeId]/pos?connectionId=<id> - Delete POS connection
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('Only store owners can delete POS connections', context.requestId)
    }

    const connectionId = request.nextUrl.searchParams.get('connectionId')
    if (!connectionId) {
      return apiBadRequest('connectionId is required', context.requestId)
    }

    const { error } = await context.supabase
      .from('pos_connections')
      .delete()
      .eq('id', connectionId)
      .eq('store_id', storeId)

    if (error) throw error

    await auditLog(context.supabase, {
      userId: context.user.id,
      storeId,
      action: 'settings.update',
      details: { action: 'pos_connection_deleted', connection_id: connectionId },
    })

    return apiSuccess({ deleted: true }, { requestId: context.requestId })
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Failed to delete POS connection')
  }
}
