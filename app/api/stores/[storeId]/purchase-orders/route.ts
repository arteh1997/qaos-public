import { NextRequest } from 'next/server'
import { withApiAuth, canAccessStore, canManageStore, parsePaginationParams } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
  createPaginationMeta,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { createPurchaseOrderSchema } from '@/lib/validations/suppliers'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * Generate next PO number for a store
 */
async function generatePoNumber(supabase: Parameters<typeof canAccessStore>[0]['supabase'], storeId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PO-${year}-`

  const { data } = await supabase
    .from('purchase_orders')
    .select('po_number')
    .eq('store_id', storeId)
    .ilike('po_number', `${prefix}%`)
    .order('po_number', { ascending: false })
    .limit(1)

  let nextNum = 1
  if (data && data.length > 0) {
    const lastNum = parseInt(data[0].po_number.replace(prefix, ''), 10)
    if (!isNaN(lastNum)) nextNum = lastNum + 1
  }

  return `${prefix}${String(nextNum).padStart(4, '0')}`
}

/**
 * GET /api/stores/:storeId/purchase-orders - List purchase orders
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

    if (!canAccessStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const { page, pageSize, from, to } = parsePaginationParams(request)
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const supplierId = searchParams.get('supplier_id')

    let query = context.supabase
      .from('purchase_orders')
      .select('*, supplier:suppliers(id, name)', { count: 'exact' })
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    if (supplierId) {
      query = query.eq('supplier_id', supplierId)
    }

    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      return apiError('Failed to fetch purchase orders')
    }

    const pagination = createPaginationMeta(page, pageSize, count ?? 0)

    return apiSuccess(data, {
      requestId: context.requestId,
      pagination,
    })
  } catch (error) {
    console.error('Error fetching purchase orders:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to fetch purchase orders')
  }
}

/**
 * POST /api/stores/:storeId/purchase-orders - Create a purchase order
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
      return apiForbidden('You do not have permission to create purchase orders', context.requestId)
    }

    const body = await request.json()
    const validation = createPurchaseOrderSchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const { items, ...orderData } = validation.data

    // Verify supplier belongs to this store
    const { data: supplier } = await context.supabase
      .from('suppliers')
      .select('id, name')
      .eq('id', orderData.supplier_id)
      .eq('store_id', storeId)
      .single()

    if (!supplier) {
      return apiBadRequest('Supplier not found in this store', context.requestId)
    }

    // Calculate total
    const totalAmount = items.reduce(
      (sum, item) => sum + item.quantity_ordered * item.unit_price,
      0
    )

    // Generate PO number
    const poNumber = await generatePoNumber(context.supabase, storeId)

    // Create the purchase order
    const { data: po, error: poError } = await context.supabase
      .from('purchase_orders')
      .insert({
        store_id: storeId,
        supplier_id: orderData.supplier_id,
        po_number: poNumber,
        status: 'draft',
        order_date: orderData.order_date || new Date().toISOString().split('T')[0],
        expected_delivery_date: orderData.expected_delivery_date || null,
        total_amount: Math.round(totalAmount * 100) / 100,
        currency: orderData.currency || 'USD',
        notes: orderData.notes || null,
        created_by: context.user.id,
      })
      .select()
      .single()

    if (poError || !po) {
      return apiError('Failed to create purchase order')
    }

    // Insert line items
    const lineItems = items.map(item => ({
      purchase_order_id: po.id,
      inventory_item_id: item.inventory_item_id,
      quantity_ordered: item.quantity_ordered,
      unit_price: item.unit_price,
      notes: item.notes || null,
    }))

    const { error: itemsError } = await context.supabase
      .from('purchase_order_items')
      .insert(lineItems)

    if (itemsError) {
      // Cleanup: delete the PO if items failed
      await context.supabase.from('purchase_orders').delete().eq('id', po.id)
      return apiError('Failed to create purchase order items')
    }

    // Fetch complete PO with items
    const { data: completePO } = await context.supabase
      .from('purchase_orders')
      .select('*, supplier:suppliers(id, name)')
      .eq('id', po.id)
      .single()

    const { data: poItems } = await context.supabase
      .from('purchase_order_items')
      .select('*, inventory_item:inventory_items(id, name, unit_of_measure)')
      .eq('purchase_order_id', po.id)

    return apiSuccess(
      { ...completePO, items: poItems || [] },
      { requestId: context.requestId, status: 201 }
    )
  } catch (error) {
    console.error('Error creating purchase order:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to create purchase order')
  }
}
