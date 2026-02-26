import { NextRequest } from 'next/server'
import { withSupplierAuth } from '@/lib/api/with-supplier-auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/supplier-portal/orders
 * List purchase orders for the authenticated supplier.
 */
export async function GET(request: NextRequest) {
  const auth = await withSupplierAuth(request, { permission: 'can_view_orders' })
  if (!auth.success) return auth.response

  const { supplierId, storeId } = auth
  const supabase = createAdminClient()

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = 20
  const offset = (page - 1) * limit

  let query = supabase
    .from('purchase_orders')
    .select('id, po_number, status, order_date, expected_delivery_date, total_amount, currency, notes, created_at', { count: 'exact' })
    .eq('supplier_id', supplierId)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data: orders, count, error } = await query

  if (error) {
    return Response.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }

  return Response.json({
    success: true,
    data: orders,
    pagination: { page, limit, total: count ?? 0 },
  })
}
