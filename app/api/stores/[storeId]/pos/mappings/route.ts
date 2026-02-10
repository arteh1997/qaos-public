import { NextRequest } from 'next/server'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest, apiForbidden } from '@/lib/api/response'

type RouteParams = { params: Promise<{ storeId: string }> }

/**
 * GET /api/stores/[storeId]/pos/mappings?connectionId=<id> - List item mappings
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

    const connectionId = request.nextUrl.searchParams.get('connectionId')
    if (!connectionId) {
      return apiBadRequest('connectionId is required', context.requestId)
    }

    const { data, error } = await context.supabase
      .from('pos_item_mappings')
      .select(`
        id, pos_item_id, pos_item_name, quantity_per_sale, is_active, created_at,
        inventory_item:inventory_items(id, name, category, unit_of_measure)
      `)
      .eq('pos_connection_id', connectionId)
      .eq('store_id', storeId)
      .order('pos_item_name', { ascending: true })

    if (error) throw error

    return apiSuccess(data ?? [], { requestId: context.requestId })
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Failed to fetch mappings')
  }
}

/**
 * POST /api/stores/[storeId]/pos/mappings - Create or update item mapping
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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
      return apiForbidden('Access denied', context.requestId)
    }

    const body = await request.json()
    const { pos_connection_id, pos_item_id, pos_item_name, inventory_item_id, quantity_per_sale } = body

    if (!pos_connection_id) {
      return apiBadRequest('pos_connection_id is required', context.requestId)
    }
    if (!pos_item_id || typeof pos_item_id !== 'string') {
      return apiBadRequest('pos_item_id is required', context.requestId)
    }
    if (!pos_item_name || typeof pos_item_name !== 'string') {
      return apiBadRequest('pos_item_name is required', context.requestId)
    }
    if (!inventory_item_id) {
      return apiBadRequest('inventory_item_id is required', context.requestId)
    }
    if (quantity_per_sale !== undefined && (typeof quantity_per_sale !== 'number' || quantity_per_sale <= 0)) {
      return apiBadRequest('quantity_per_sale must be a positive number', context.requestId)
    }

    const { data, error } = await context.supabase
      .from('pos_item_mappings')
      .upsert({
        pos_connection_id,
        store_id: storeId,
        pos_item_id,
        pos_item_name: pos_item_name.trim(),
        inventory_item_id,
        quantity_per_sale: quantity_per_sale ?? 1,
      }, {
        onConflict: 'pos_connection_id,pos_item_id',
      })
      .select('id, pos_item_id, pos_item_name, inventory_item_id, quantity_per_sale, is_active')
      .single()

    if (error) throw error

    return apiSuccess(data, { requestId: context.requestId, status: 201 })
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Failed to save mapping')
  }
}

/**
 * DELETE /api/stores/[storeId]/pos/mappings?mappingId=<id> - Delete mapping
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
      return apiForbidden('Access denied', context.requestId)
    }

    const mappingId = request.nextUrl.searchParams.get('mappingId')
    if (!mappingId) {
      return apiBadRequest('mappingId is required', context.requestId)
    }

    const { error } = await context.supabase
      .from('pos_item_mappings')
      .delete()
      .eq('id', mappingId)
      .eq('store_id', storeId)

    if (error) throw error

    return apiSuccess({ deleted: true }, { requestId: context.requestId })
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Failed to delete mapping')
  }
}
