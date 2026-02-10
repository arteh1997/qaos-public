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
      .select('id, status, store_id')
      .eq('id', poId)
      .eq('store_id', storeId)
      .single()

    if (!po) {
      return apiNotFound('Purchase order', context.requestId)
    }

    const receivableStatuses = ['submitted', 'acknowledged', 'shipped', 'partial']
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
      .select('id, inventory_item_id, quantity_ordered, quantity_received')
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

    // Get current inventory levels
    const currentInventoryMap = await getCurrentInventoryMap(context.supabase, storeId)
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

    return apiSuccess(
      {
        message: 'Items received successfully',
        items_received: inventoryUpdates.length,
        new_status: newStatus,
      },
      { requestId: context.requestId, status: 201 }
    )
  } catch (error) {
    console.error('Error receiving purchase order:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to receive purchase order')
  }
}
