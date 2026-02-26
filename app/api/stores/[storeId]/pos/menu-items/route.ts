import { NextRequest } from 'next/server'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest, apiForbidden } from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdapter } from '@/lib/services/pos'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * GET /api/stores/:storeId/pos/menu-items?connection_id=xxx
 * Fetch menu items from the POS provider's API for item mapping.
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
    const connectionId = searchParams.get('connection_id')

    if (!connectionId) {
      return apiBadRequest('connection_id is required', context.requestId)
    }

    const supabase = createAdminClient()

    const { data: connection } = await supabase
      .from('pos_connections')
      .select('id, provider, credentials, is_active')
      .eq('id', connectionId)
      .eq('store_id', storeId)
      .single()

    if (!connection) {
      return apiBadRequest('Connection not found', context.requestId)
    }

    if (!connection.is_active) {
      return apiBadRequest('Connection is inactive', context.requestId)
    }

    const adapter = getAdapter(connection.provider)
    if (!adapter?.fetchMenuItems) {
      return apiBadRequest(
        `Provider "${connection.provider}" does not support menu sync`,
        context.requestId
      )
    }

    const credentials = (connection.credentials || {}) as Record<string, unknown>
    const menuItems = await adapter.fetchMenuItems(credentials)

    // Get existing mappings for this connection
    const { data: existingMappings } = await supabase
      .from('pos_item_mappings')
      .select('pos_item_id, inventory_item_id, is_active')
      .eq('pos_connection_id', connectionId)

    const mappingMap = new Map(
      (existingMappings || []).map(m => [m.pos_item_id, m])
    )

    // Enrich items with mapping status
    const enrichedItems = menuItems.map(item => ({
      ...item,
      is_mapped: mappingMap.has(item.pos_item_id),
      mapping: mappingMap.get(item.pos_item_id) || null,
    }))

    return apiSuccess(enrichedItems, { requestId: context.requestId })
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'Failed to fetch menu items',
      { status: 500 }
    )
  }
}
