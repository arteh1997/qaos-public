import { NextRequest } from 'next/server'
import { withApiAuth, canAccessStore } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { stockCountSchema } from '@/lib/validations/inventory'
import { sanitizeNotes } from '@/lib/utils'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
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
 * POST /api/stores/:storeId/stock-count - Submit a stock count
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
    const validationResult = stockCountSchema.safeParse(dataToValidate)
    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const { items, notes } = validationResult.data

    // Verify all inventory items are still active (not deleted)
    const itemIds = items.map(item => item.inventory_item_id)
    try {
      await verifyActiveItems(context.supabase, itemIds, context.requestId)
    } catch (err) {
      return apiBadRequest(
        err instanceof Error ? err.message : 'Some items have been deleted',
        context.requestId
      )
    }

    // Get current inventory levels
    const currentInventoryMap = await getCurrentInventoryMap(context.supabase, storeId)

    // Prepare operation data
    const now = new Date().toISOString()
    const sanitizedNotes = sanitizeNotes(notes)

    const inventoryUpdates = prepareInventoryUpdates(
      items,
      storeId,
      context.user.id,
      now
    )

    const historyInserts = prepareHistoryInserts(
      items,
      currentInventoryMap,
      storeId,
      context.user.id,
      'Count',
      sanitizedNotes ?? null
    )

    // Re-verify store access before writes (prevents TOCTOU vulnerabilities)
    await verifyStoreAccess(context.supabase, storeId, context.user.id)

    // Execute the stock operation (upsert inventory, insert history, mark daily count)
    const itemsUpdated = await executeStockOperation(
      context.supabase,
      storeId,
      context.user.id,
      inventoryUpdates,
      historyInserts,
      true // markDailyCountComplete
    )

    const today = new Date().toISOString().split('T')[0]

    // Audit log the stock count
    const adminClient = createAdminClient()
    await auditLog(adminClient, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'stock.count_submit',
      storeId,
      resourceType: 'stock_count',
      details: {
        itemsUpdated,
        date: today,
      },
      request,
    })

    return apiSuccess(
      {
        message: 'Stock count submitted successfully',
        itemsUpdated,
        date: today,
      },
      { requestId: context.requestId, status: 201 }
    )
  } catch (error) {
    console.error('Error submitting stock count:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to submit stock count')
  }
}
