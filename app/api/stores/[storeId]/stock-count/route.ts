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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: activeItems } = await (context.supabase as any)
      .from('inventory_items')
      .select('id')
      .in('id', itemIds)
      .eq('is_active', true)

    const activeItemIds = new Set((activeItems ?? []).map((item: { id: string }) => item.id))
    const deletedItems = items.filter(item => !activeItemIds.has(item.inventory_item_id))

    if (deletedItems.length > 0) {
      return apiBadRequest(
        `Some items have been deleted and cannot be counted. Please refresh the page to see the current inventory list.`,
        context.requestId
      )
    }

    // Get current inventory levels
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: currentInventory } = await (context.supabase as any)
      .from('store_inventory')
      .select('inventory_item_id, quantity')
      .eq('store_id', storeId)

    const currentMap = new Map<string, number>(
      (currentInventory ?? []).map((item: { inventory_item_id: string; quantity: number }) => [item.inventory_item_id, item.quantity])
    )

    const now = new Date().toISOString()
    const sanitizedNotes = sanitizeNotes(notes)

    // Prepare batch data
    const inventoryUpdates = items.map(item => ({
      store_id: storeId,
      inventory_item_id: item.inventory_item_id,
      quantity: item.quantity,
      last_updated_at: now,
      last_updated_by: context.user.id,
    }))

    const historyInserts = items.map(item => {
      const quantityBefore = currentMap.get(item.inventory_item_id) ?? 0
      return {
        store_id: storeId,
        inventory_item_id: item.inventory_item_id,
        action_type: 'Count' as const,
        quantity_before: quantityBefore,
        quantity_after: item.quantity,
        quantity_change: item.quantity - quantityBefore,
        performed_by: context.user.id,
        notes: sanitizedNotes,
      }
    })

    // Re-verify store access before writes (in case access was revoked mid-operation)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: currentAccess } = await (context.supabase as any)
      .from('store_users')
      .select('id')
      .eq('store_id', storeId)
      .eq('user_id', context.user.id)
      .single()

    if (!currentAccess) {
      return apiForbidden('Your access to this store has been revoked', context.requestId)
    }

    // Batch upsert store inventory
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (context.supabase as any)
      .from('store_inventory')
      .upsert(inventoryUpdates, { onConflict: 'store_id,inventory_item_id' })

    if (updateError) throw updateError

    // Batch insert stock history
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: historyError } = await (context.supabase as any)
      .from('stock_history')
      .insert(historyInserts)

    if (historyError) throw historyError

    // Mark daily count as complete
    const today = new Date().toISOString().split('T')[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: dailyCountError } = await (context.supabase as any)
      .from('daily_counts')
      .upsert(
        {
          store_id: storeId,
          count_date: today,
          submitted_by: context.user.id,
          submitted_at: now,
        },
        { onConflict: 'store_id,count_date' }
      )

    if (dailyCountError) throw dailyCountError

    // Audit log the stock count
    const adminClient = createAdminClient()
    await auditLog(adminClient, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'stock.count_submit',
      storeId,
      resourceType: 'stock_count',
      details: {
        itemsUpdated: items.length,
        date: today,
      },
      request,
    })

    return apiSuccess(
      {
        message: 'Stock count submitted successfully',
        itemsUpdated: items.length,
        date: today,
      },
      { requestId: context.requestId, status: 201 }
    )
  } catch (error) {
    console.error('Error submitting stock count:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to submit stock count')
  }
}
