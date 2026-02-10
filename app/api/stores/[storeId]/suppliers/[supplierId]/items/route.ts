import { NextRequest } from 'next/server'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
  apiNotFound,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { supplierItemSchema, updateSupplierItemSchema } from '@/lib/validations/suppliers'

interface RouteParams {
  params: Promise<{ storeId: string; supplierId: string }>
}

/**
 * GET /api/stores/:storeId/suppliers/:supplierId/items - List supplier items
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

    // Verify supplier belongs to this store
    const { data: supplier } = await context.supabase
      .from('suppliers')
      .select('id')
      .eq('id', supplierId)
      .eq('store_id', storeId)
      .single()

    if (!supplier) {
      return apiNotFound('Supplier', context.requestId)
    }

    const { data, error } = await context.supabase
      .from('supplier_items')
      .select('*, inventory_item:inventory_items(id, name, category, unit_of_measure)')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })

    if (error) {
      return apiError('Failed to fetch supplier items')
    }

    return apiSuccess(data, { requestId: context.requestId })
  } catch (error) {
    console.error('Error fetching supplier items:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to fetch supplier items')
  }
}

/**
 * POST /api/stores/:storeId/suppliers/:supplierId/items - Add item to supplier
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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
      return apiForbidden('You do not have permission to manage supplier items', context.requestId)
    }

    // Verify supplier belongs to this store
    const { data: supplier } = await context.supabase
      .from('suppliers')
      .select('id')
      .eq('id', supplierId)
      .eq('store_id', storeId)
      .single()

    if (!supplier) {
      return apiNotFound('Supplier', context.requestId)
    }

    const body = await request.json()
    const validation = supplierItemSchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const { data, error } = await context.supabase
      .from('supplier_items')
      .insert({
        supplier_id: supplierId,
        inventory_item_id: validation.data.inventory_item_id,
        supplier_sku: validation.data.supplier_sku || null,
        unit_cost: validation.data.unit_cost,
        currency: validation.data.currency,
        lead_time_days: validation.data.lead_time_days ?? null,
        min_order_quantity: validation.data.min_order_quantity,
        is_preferred: validation.data.is_preferred ?? false,
        is_active: validation.data.is_active ?? true,
      })
      .select('*, inventory_item:inventory_items(id, name, category, unit_of_measure)')
      .single()

    if (error) {
      if (error.code === '23505') {
        return apiBadRequest('This item is already linked to this supplier', context.requestId)
      }
      return apiError('Failed to add supplier item')
    }

    return apiSuccess(data, { requestId: context.requestId, status: 201 })
  } catch (error) {
    console.error('Error adding supplier item:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to add supplier item')
  }
}

/**
 * PUT /api/stores/:storeId/suppliers/:supplierId/items?itemId=... - Update supplier item
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, supplierId } = await params
    const itemId = request.nextUrl.searchParams.get('itemId')

    if (!itemId) {
      return apiBadRequest('itemId query parameter is required')
    }

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to manage supplier items', context.requestId)
    }

    const body = await request.json()
    const validation = updateSupplierItemSchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const { data, error } = await context.supabase
      .from('supplier_items')
      .update(validation.data)
      .eq('id', itemId)
      .eq('supplier_id', supplierId)
      .select('*, inventory_item:inventory_items(id, name, category, unit_of_measure)')
      .single()

    if (error || !data) {
      return apiNotFound('Supplier item', context.requestId)
    }

    return apiSuccess(data, { requestId: context.requestId })
  } catch (error) {
    console.error('Error updating supplier item:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to update supplier item')
  }
}

/**
 * DELETE /api/stores/:storeId/suppliers/:supplierId/items?itemId=... - Remove supplier item
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, supplierId } = await params
    const itemId = request.nextUrl.searchParams.get('itemId')

    if (!itemId) {
      return apiBadRequest('itemId query parameter is required')
    }

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to manage supplier items', context.requestId)
    }

    const { error } = await context.supabase
      .from('supplier_items')
      .delete()
      .eq('id', itemId)
      .eq('supplier_id', supplierId)

    if (error) {
      return apiError('Failed to remove supplier item')
    }

    return apiSuccess({ message: 'Supplier item removed successfully' }, { requestId: context.requestId })
  } catch (error) {
    console.error('Error removing supplier item:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to remove supplier item')
  }
}
