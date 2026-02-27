import { NextRequest } from 'next/server'
import { withApiAuth, canAccessStore } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { stockReceptionSchema } from '@/lib/validations/inventory'
import { sanitizeNotes } from '@/lib/utils'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'
import {
  verifyActiveItems,
  getCurrentInventoryMap,
  prepareInventoryUpdates,
  prepareHistoryInserts,
  verifyStoreAccess,
  executeStockOperation,
} from '@/lib/services/stockOperations'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * POST /api/stores/:storeId/stock-reception - Record stock reception
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager', 'Staff'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // Check store access (uses store_users membership)
    if (!canAccessStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const body = await request.json()

    // Add store_id to body for validation
    const dataToValidate = { ...body, store_id: storeId }

    // Validate input
    const validationResult = stockReceptionSchema.safeParse(dataToValidate)
    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const { items, notes } = validationResult.data

    // Filter items with positive quantity
    const validItems = items.filter(item => item.quantity > 0)

    if (validItems.length === 0) {
      return apiBadRequest(
        'At least one item with quantity > 0 is required',
        context.requestId
      )
    }

    // Verify all inventory items are still active (not deleted)
    const itemIds = validItems.map(item => item.inventory_item_id)

    // Fetch item names for audit log
    const { data: itemDetails } = await context.supabase
      .from('inventory_items')
      .select('id, name, unit_of_measure')
      .in('id', itemIds)
    const itemNameMap = new Map(itemDetails?.map((i: { id: string; name: string; unit_of_measure: string }) => [i.id, i]) || [])

    try {
      await verifyActiveItems(context.supabase, itemIds, context.requestId)
    } catch (err) {
      return apiBadRequest(
        err instanceof Error ? err.message : 'Some items have been deleted',
        context.requestId
      )
    }

    // Get current inventory levels
    const currentInventoryMap = await getCurrentInventoryMap(context.supabase, storeId, itemIds)

    // Prepare operation data
    const now = new Date().toISOString()
    const sanitizedNotes = sanitizeNotes(notes)

    // Transform reception items to final quantities (current + received)
    const itemsWithFinalQuantity = validItems.map(item => ({
      inventory_item_id: item.inventory_item_id,
      quantity: (currentInventoryMap.get(item.inventory_item_id) ?? 0) + item.quantity,
    }))

    const inventoryUpdates = prepareInventoryUpdates(
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
      sanitizedNotes ?? null
    )

    // Re-verify store access before writes (prevents TOCTOU vulnerabilities)
    await verifyStoreAccess(context.supabase, storeId, context.user.id)

    // Execute the stock operation (upsert inventory, insert history)
    const itemsUpdated = await executeStockOperation(
      context.supabase,
      storeId,
      context.user.id,
      inventoryUpdates,
      historyInserts,
      false // Don't mark daily count for receptions
    )

    // Update unit costs for items with cost data (separate from quantity upsert)
    const costItems = validItems.filter(
      item => item.total_cost !== undefined && item.total_cost !== null && item.quantity > 0
    )
    for (const item of costItems) {
      const unitCost = Math.round((item.total_cost! / item.quantity) * 10000) / 10000
      await context.supabase
        .from('store_inventory')
        .update({ unit_cost: unitCost, cost_currency: 'GBP' })
        .eq('store_id', storeId)
        .eq('inventory_item_id', item.inventory_item_id)
    }

    const admin = createAdminClient()
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'stock.reception_submit',
      storeId,
      resourceType: 'stock_reception',
      details: {
        itemCount: validItems.length,
        totalQuantity: validItems.reduce((sum, item) => sum + item.quantity, 0),
        totalCost: costItems.reduce((sum, item) => sum + (item.total_cost ?? 0), 0) || undefined,
        notes: sanitizedNotes || undefined,
        supplierName: body.supplier_name || undefined,
        items: validItems.map(item => {
          const info = itemNameMap.get(item.inventory_item_id)
          return {
            name: info?.name || 'Unknown Item',
            quantity: item.quantity,
            unit: info?.unit_of_measure || '',
            totalCost: item.total_cost ?? null,
          }
        }),
      },
      request,
    })

    return apiSuccess(
      {
        message: 'Stock reception recorded successfully',
        itemsReceived: itemsUpdated,
        totalQuantity: validItems.reduce((sum, item) => sum + item.quantity, 0),
      },
      { requestId: context.requestId, status: 201 }
    )
  } catch (error) {
    logger.error('Error recording stock reception:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to record stock reception')
  }
}
