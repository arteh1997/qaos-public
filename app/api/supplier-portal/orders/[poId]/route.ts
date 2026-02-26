import { NextRequest } from 'next/server'
import { withSupplierAuth } from '@/lib/api/with-supplier-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateOrderStatusSchema } from '@/lib/validations/supplier-portal'
import { logPortalActivity } from '@/lib/services/supplier-portal'
import { notifyStoreManagement } from '@/lib/services/notifications'

/**
 * GET  /api/supplier-portal/orders/[poId]
 * Get PO detail with line items.
 *
 * PATCH /api/supplier-portal/orders/[poId]
 * Supplier updates PO status (acknowledge / mark shipped).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ poId: string }> }
) {
  const { poId } = await params
  const auth = await withSupplierAuth(request, { permission: 'can_view_orders' })
  if (!auth.success) return auth.response

  const { supplierId, storeId } = auth
  const supabase = createAdminClient()

  const { data: order, error } = await supabase
    .from('purchase_orders')
    .select(`
      id, po_number, status, order_date, expected_delivery_date,
      total_amount, currency, notes, created_at,
      purchase_order_items (
        id, inventory_item_id, quantity_ordered, quantity_received, unit_price, notes,
        inventory_items ( name, unit_of_measure )
      )
    `)
    .eq('id', poId)
    .eq('supplier_id', supplierId)
    .eq('store_id', storeId)
    .single()

  if (error || !order) {
    return Response.json(
      { success: false, error: 'Order not found' },
      { status: 404 }
    )
  }

  return Response.json({ success: true, data: order })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ poId: string }> }
) {
  const { poId } = await params
  const auth = await withSupplierAuth(request, { permission: 'can_update_order_status' })
  if (!auth.success) return auth.response

  const { supplierId, storeId, tokenId } = auth
  const supabase = createAdminClient()

  const body = await request.json()
  const parsed = updateOrderStatusSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { success: false, error: parsed.error.issues[0]?.message || 'Invalid request' },
      { status: 400 }
    )
  }

  // Verify the PO belongs to this supplier + store
  const { data: existing } = await supabase
    .from('purchase_orders')
    .select('id, status')
    .eq('id', poId)
    .eq('supplier_id', supplierId)
    .eq('store_id', storeId)
    .single()

  if (!existing) {
    return Response.json(
      { success: false, error: 'Order not found' },
      { status: 404 }
    )
  }

  // Only allow specific transitions
  const allowedTransitions: Record<string, string[]> = {
    open: ['acknowledged'],
    awaiting_delivery: ['acknowledged', 'shipped'],
    acknowledged: ['shipped'],
  }

  const allowed = allowedTransitions[existing.status] || []
  if (!allowed.includes(parsed.data.status)) {
    return Response.json(
      { success: false, error: `Cannot transition from "${existing.status}" to "${parsed.data.status}"` },
      { status: 400 }
    )
  }

  // Map supplier status to system status
  const statusMap: Record<string, string> = {
    acknowledged: 'awaiting_delivery',
    shipped: 'awaiting_delivery',
  }

  const systemStatus = statusMap[parsed.data.status] || parsed.data.status

  const updateData: Record<string, unknown> = { status: systemStatus }
  if (parsed.data.notes) {
    updateData.notes = parsed.data.notes
  }

  const { error: updateErr } = await supabase
    .from('purchase_orders')
    .update(updateData)
    .eq('id', poId)

  if (updateErr) {
    return Response.json(
      { success: false, error: 'Failed to update order' },
      { status: 500 }
    )
  }

  await logPortalActivity({
    supplierId,
    storeId,
    tokenId,
    action: 'order.status_updated',
    details: { poId, from: existing.status, to: parsed.data.status },
  })

  // Notify store Owners/Managers about PO status change (fire-and-forget)
  const { data: poDetail } = await supabase
    .from('purchase_orders')
    .select('po_number, total_amount, currency, expected_delivery_date, supplier:suppliers(name)')
    .eq('id', poId)
    .single()

  const { data: store } = await supabase
    .from('stores')
    .select('name')
    .eq('id', storeId)
    .single()

  const { data: poItemCount } = await supabase
    .from('purchase_order_items')
    .select('id', { count: 'exact', head: true })
    .eq('purchase_order_id', poId)

  notifyStoreManagement({
    type: 'po_supplier_update',
    storeId,
    data: {
      storeName: store?.name || 'your store',
      poNumber: poDetail?.po_number || poId,
      supplierName: (poDetail?.supplier as { name: string } | null)?.name || 'Supplier',
      status: parsed.data.status,
      expectedDeliveryDate: poDetail?.expected_delivery_date || null,
      itemCount: poItemCount ?? 0,
      totalAmount: poDetail?.total_amount || 0,
      currency: poDetail?.currency || 'GBP',
    },
  }).catch(() => {})

  return Response.json({ success: true, data: { id: poId, status: systemStatus } })
}
