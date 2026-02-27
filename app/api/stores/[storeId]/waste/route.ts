import { NextRequest } from 'next/server'
import { withApiAuth, canAccessStore } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
  createPaginationMeta,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { wasteReportSchema } from '@/lib/validations/inventory'
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
import { parsePaginationParams } from '@/lib/api/middleware'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * POST /api/stores/:storeId/waste - Record a waste report
 *
 * Deducts wasted quantities from inventory, records in stock_history,
 * and creates detailed waste_log entries with reasons.
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

    if (!canAccessStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const body = await request.json()
    const dataToValidate = { ...body, store_id: storeId }

    const validationResult = wasteReportSchema.safeParse(dataToValidate)
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

    // Verify all inventory items are still active
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

    const now = new Date().toISOString()
    const sanitizedNotes = sanitizeNotes(notes)

    // Transform waste items to final quantities (current - wasted, floor at 0)
    const itemsWithFinalQuantity = validItems.map(item => ({
      inventory_item_id: item.inventory_item_id,
      quantity: Math.max(0, (currentInventoryMap.get(item.inventory_item_id) ?? 0) - item.quantity),
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
      'Waste',
      sanitizedNotes ?? null
    )

    // Re-verify store access before writes
    await verifyStoreAccess(context.supabase, storeId, context.user.id)

    // Execute the stock operation (update inventory, insert history)
    const itemsUpdated = await executeStockOperation(
      context.supabase,
      storeId,
      context.user.id,
      inventoryUpdates,
      historyInserts,
      false // Don't mark daily count for waste reports
    )

    // Insert detailed waste log entries
    const wasteLogEntries = validItems.map(item => ({
      store_id: storeId,
      inventory_item_id: item.inventory_item_id,
      quantity: item.quantity,
      reason: item.reason || 'other',
      notes: sanitizedNotes || null,
      estimated_cost: 0,
      reported_by: context.user.id,
      reported_at: now,
    }))

    const { error: wasteLogError } = await context.supabase
      .from('waste_log')
      .insert(wasteLogEntries)

    if (wasteLogError) {
      logger.error('Failed to insert waste log entries:', { error: wasteLogError })
      // Don't fail the whole operation - inventory is already updated
    }

    const admin = createAdminClient()
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'waste.submit',
      storeId,
      resourceType: 'waste_log',
      details: {
        itemCount: validItems.length,
        totalWasted: validItems.reduce((sum, item) => sum + item.quantity, 0),
        notes: sanitizedNotes || undefined,
        items: validItems.map(item => {
          const info = itemNameMap.get(item.inventory_item_id)
          return {
            name: info?.name || 'Unknown Item',
            quantity: item.quantity,
            unit: info?.unit_of_measure || '',
            reason: item.reason || 'other',
          }
        }),
      },
      request,
    })

    return apiSuccess(
      {
        message: 'Waste report recorded successfully',
        itemsReported: itemsUpdated,
        totalWasted: validItems.reduce((sum, item) => sum + item.quantity, 0),
      },
      { requestId: context.requestId, status: 201 }
    )
  } catch (error) {
    logger.error('Error recording waste report:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to record waste report')
  }
}

/**
 * GET /api/stores/:storeId/waste - Get waste history
 *
 * Query params:
 *   - page (default: 1)
 *   - pageSize (default: 20)
 *   - reason (filter by reason)
 *   - from (date filter start, ISO string)
 *   - to (date filter end, ISO string)
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
    const reason = searchParams.get('reason')
    const fromDate = searchParams.get('from')
    const toDate = searchParams.get('to')

    // Build query
    let query = context.supabase
      .from('waste_log')
      .select('*, inventory_item:inventory_items(id, name, category, unit_of_measure)', { count: 'exact' })
      .eq('store_id', storeId)
      .order('reported_at', { ascending: false })

    if (reason) {
      query = query.eq('reason', reason)
    }

    if (fromDate) {
      query = query.gte('reported_at', fromDate)
    }

    if (toDate) {
      query = query.lte('reported_at', toDate)
    }

    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      return apiError('Failed to fetch waste history')
    }

    const pagination = createPaginationMeta(page, pageSize, count ?? 0)

    return apiSuccess(data, {
      requestId: context.requestId,
      pagination,
    })
  } catch (error) {
    logger.error('Error fetching waste history:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to fetch waste history')
  }
}
