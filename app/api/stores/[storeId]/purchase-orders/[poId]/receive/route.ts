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
import { receivePurchaseOrderSchema } from '@/lib/validations/suppliers'
import {
  getCurrentInventoryMap,
  prepareInventoryUpdates,
  prepareHistoryInserts,
  executeStockOperation,
} from '@/lib/services/stockOperations'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import { notifyStoreManagement } from '@/lib/services/notifications'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string; poId: string }>
}

/**
 * POST /api/stores/:storeId/purchase-orders/:poId/receive - Receive items from PO
 *
 * Updates inventory quantities and marks items as received.
 * Integrates with the stock operations system.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, poId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to receive purchase orders', context.requestId)
    }

    // Verify PO exists and is in receivable status
    const { data: po } = await context.supabase
      .from('purchase_orders')
      .select('id, status, store_id, po_number')
      .eq('id', poId)
      .eq('store_id', storeId)
      .single()

    if (!po) {
      return apiNotFound('Purchase order', context.requestId)
    }

    const receivableStatuses = ['open', 'awaiting_delivery', 'partial']
    if (!receivableStatuses.includes(po.status)) {
      return apiBadRequest(
        `Cannot receive items for a purchase order with status '${po.status}'`,
        context.requestId
      )
    }

    const body = await request.json()
    const validation = receivePurchaseOrderSchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const { items: receivedItems, notes } = validation.data

    // Fetch existing PO items
    const { data: poItems } = await context.supabase
      .from('purchase_order_items')
      .select('id, inventory_item_id, quantity_ordered, quantity_received, unit_price')
      .eq('purchase_order_id', poId)

    if (!poItems || poItems.length === 0) {
      return apiBadRequest('Purchase order has no items', context.requestId)
    }

    const poItemMap = new Map(poItems.map(item => [item.id, item]))

    // Validate received items
    const inventoryUpdates: { inventory_item_id: string; quantity: number }[] = []
    const poItemUpdates: { id: string; quantity_received: number }[] = []

    for (const received of receivedItems) {
      const poItem = poItemMap.get(received.purchase_order_item_id)
      if (!poItem) {
        return apiBadRequest(
          `Line item ${received.purchase_order_item_id} not found in this purchase order`,
          context.requestId
        )
      }

      if (received.quantity_received <= 0) continue

      const newTotal = poItem.quantity_received + received.quantity_received

      poItemUpdates.push({
        id: poItem.id,
        quantity_received: newTotal,
      })

      inventoryUpdates.push({
        inventory_item_id: poItem.inventory_item_id,
        quantity: received.quantity_received,
      })
    }

    if (inventoryUpdates.length === 0) {
      return apiBadRequest('No items with positive quantity to receive', context.requestId)
    }

    // Get current inventory levels (filtered to only items being received)
    const receivedItemIds = inventoryUpdates.map(u => u.inventory_item_id)
    const currentInventoryMap = await getCurrentInventoryMap(context.supabase, storeId, receivedItemIds)
    const now = new Date().toISOString()

    // Calculate new quantities (current + received)
    const itemsWithFinalQuantity = inventoryUpdates.map(item => ({
      inventory_item_id: item.inventory_item_id,
      quantity: (currentInventoryMap.get(item.inventory_item_id) ?? 0) + item.quantity,
    }))

    const invUpdates = prepareInventoryUpdates(
      itemsWithFinalQuantity,
      storeId,
      context.user.id,
      now
    )

    const historyInserts = prepareHistoryInserts(
      itemsWithFinalQuantity,
      currentInventoryMap,
      storeId,
      context.user.id,
      'Reception',
      notes ? `PO Receive: ${notes}` : `PO Receive: ${poId}`
    )

    // Execute stock operation
    await executeStockOperation(
      context.supabase,
      storeId,
      context.user.id,
      invUpdates,
      historyInserts,
      false
    )

    // Update PO item received quantities
    for (const update of poItemUpdates) {
      await context.supabase
        .from('purchase_order_items')
        .update({ quantity_received: update.quantity_received })
        .eq('id', update.id)
    }

    // Update unit costs from PO line item prices (latest price method)
    for (const received of receivedItems) {
      if (received.quantity_received <= 0) continue
      const poItem = poItemMap.get(received.purchase_order_item_id)
      if (!poItem || !poItem.unit_price || poItem.unit_price <= 0) continue

      await context.supabase
        .from('store_inventory')
        .update({
          unit_cost: poItem.unit_price,
          cost_currency: 'GBP',
        })
        .eq('store_id', storeId)
        .eq('inventory_item_id', poItem.inventory_item_id)
    }

    // Determine new PO status
    const { data: updatedItems } = await context.supabase
      .from('purchase_order_items')
      .select('quantity_ordered, quantity_received')
      .eq('purchase_order_id', poId)

    let allReceived = true
    let anyReceived = false
    for (const item of updatedItems || []) {
      if (item.quantity_received >= item.quantity_ordered) {
        anyReceived = true
      } else {
        allReceived = false
        if (item.quantity_received > 0) anyReceived = true
      }
    }

    const newStatus = allReceived ? 'received' : anyReceived ? 'partial' : po.status

    const updateData: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'received') {
      updateData.actual_delivery_date = new Date().toISOString().split('T')[0]
    }

    await context.supabase
      .from('purchase_orders')
      .update(updateData)
      .eq('id', poId)

    // Audit log
    const admin = createAdminClient()
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'purchase_order.receive',
      storeId,
      resourceType: 'purchase_order',
      resourceId: poId,
      details: {
        poNumber: po.po_number,
        itemsReceived: inventoryUpdates.length,
        newStatus,
      },
      request,
    })

    // Send delivery received notification to Owners/Managers (fire-and-forget)
    // Get supplier name
    const { data: poWithSupplier } = await context.supabase
      .from('purchase_orders')
      .select('supplier:suppliers(name), total_amount, currency')
      .eq('id', poId)
      .single()

    // Get store name
    const { data: store } = await context.supabase
      .from('stores')
      .select('name')
      .eq('id', storeId)
      .single()

    // Get receiver's name
    const { data: receiverProfile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', context.user.id)
      .single()

    notifyStoreManagement({
      type: 'delivery_received',
      storeId,
      triggeredByUserId: context.user.id,
      data: {
        storeName: store?.name || 'your store',
        poNumber: po.po_number,
        supplierName: (poWithSupplier?.supplier as { name: string } | null)?.name || 'Supplier',
        receivedByName: receiverProfile?.full_name || 'A team member',
        itemsReceived: inventoryUpdates.length,
        totalItems: poItems.length,
        totalValue: poWithSupplier?.total_amount || 0,
        currency: poWithSupplier?.currency || 'GBP',
      },
    }).catch(() => {})

    return apiSuccess(
      {
        message: 'Items received successfully',
        items_received: inventoryUpdates.length,
        new_status: newStatus,
      },
      { requestId: context.requestId, status: 201 }
    )
  } catch (error) {
    logger.error('Error receiving purchase order:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to receive purchase order')
  }
}
