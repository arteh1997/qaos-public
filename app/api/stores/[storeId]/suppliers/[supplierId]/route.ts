import { NextRequest } from 'next/server'
import { withApiAuth, canAccessStore, canManageStore } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
  apiNotFound,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { updateSupplierSchema } from '@/lib/validations/suppliers'

interface RouteParams {
  params: Promise<{ storeId: string; supplierId: string }>
}

/**
 * GET /api/stores/:storeId/suppliers/:supplierId - Get supplier detail
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, supplierId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canAccessStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const { data, error } = await context.supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .eq('store_id', storeId)
      .single()

    if (error || !data) {
      return apiNotFound('Supplier', context.requestId)
    }

    // Fetch supplier items with inventory details
    const { data: items } = await context.supabase
      .from('supplier_items')
      .select('*, inventory_item:inventory_items(id, name, category, unit_of_measure)')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })

    // Fetch recent purchase orders
    const { data: orders } = await context.supabase
      .from('purchase_orders')
      .select('id, po_number, status, order_date, total_amount, currency')
      .eq('supplier_id', supplierId)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(10)

    return apiSuccess({
      ...data,
      items: items || [],
      recent_orders: orders || [],
    }, { requestId: context.requestId })
  } catch (error) {
    console.error('Error fetching supplier:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to fetch supplier')
  }
}

/**
 * PUT /api/stores/:storeId/suppliers/:supplierId - Update supplier
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, supplierId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to update suppliers', context.requestId)
    }

    const body = await request.json()
    const validation = updateSupplierSchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    // Clean empty strings to null
    const cleanData: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(validation.data)) {
      cleanData[k] = v === '' ? null : v
    }

    const { data, error } = await context.supabase
      .from('suppliers')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(cleanData as any)
      .eq('id', supplierId)
      .eq('store_id', storeId)
      .select()
      .single()

    if (error || !data) {
      if (error?.code === '23505') {
        return apiBadRequest('A supplier with this name already exists', context.requestId)
      }
      return apiNotFound('Supplier', context.requestId)
    }

    return apiSuccess(data, { requestId: context.requestId })
  } catch (error) {
    console.error('Error updating supplier:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to update supplier')
  }
}

/**
 * DELETE /api/stores/:storeId/suppliers/:supplierId - Delete supplier
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, supplierId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to delete suppliers', context.requestId)
    }

    // Check for active purchase orders
    const { data: activePOs } = await context.supabase
      .from('purchase_orders')
      .select('id')
      .eq('supplier_id', supplierId)
      .in('status', ['submitted', 'acknowledged', 'shipped', 'partial'])
      .limit(1)

    if (activePOs && activePOs.length > 0) {
      return apiBadRequest(
        'Cannot delete supplier with active purchase orders. Cancel or complete them first.',
        context.requestId
      )
    }

    const { error } = await context.supabase
      .from('suppliers')
      .delete()
      .eq('id', supplierId)
      .eq('store_id', storeId)

    if (error) {
      return apiError('Failed to delete supplier')
    }

    return apiSuccess({ message: 'Supplier deleted successfully' }, { requestId: context.requestId })
  } catch (error) {
    console.error('Error deleting supplier:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to delete supplier')
  }
}
