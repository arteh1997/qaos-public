import { NextRequest } from 'next/server'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import { z } from 'zod'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

const batchUpdateItemSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().min(0).optional(),
  par_level: z.number().int().min(0).nullable().optional(),
  unit_cost: z.number().min(0).optional(),
})

const batchUpdateSchema = z.object({
  updates: z.array(batchUpdateItemSchema).min(1, 'At least one update is required').max(200),
})

/**
 * PATCH /api/stores/:storeId/inventory/batch - Batch update multiple inventory items
 *
 * Accepts an array of updates and applies them all, creating a single audit log entry.
 * This prevents 60+ individual audit entries when editing inventory inline.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
      return apiForbidden('You do not have permission to update inventory', context.requestId)
    }

    const body = await request.json()
    const validation = batchUpdateSchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const { updates } = validation.data
    const admin = createAdminClient()

    // Fetch current values for all items being updated (for stock_history)
    const itemIds = updates.map(u => u.itemId)
    const { data: currentItems } = await admin
      .from('store_inventory')
      .select('inventory_item_id, quantity, par_level, unit_cost')
      .eq('store_id', storeId)
      .in('inventory_item_id', itemIds)

    const currentMap = new Map(
      (currentItems || []).map(item => [item.inventory_item_id, item])
    )

    // Fetch item names for the audit log
    const { data: itemNames } = await admin
      .from('inventory_items')
      .select('id, name')
      .in('id', itemIds)

    const nameMap = new Map(
      (itemNames || []).map(item => [item.id, item.name])
    )

    // Process each update
    const results: Array<{ itemId: string; success: boolean }> = []
    const changes: Array<{
      itemName: string
      field: string
      from: unknown
      to: unknown
    }> = []

    for (const update of updates) {
      const current = currentMap.get(update.itemId)
      const itemName = nameMap.get(update.itemId) || 'Unknown'

      const updateFields: Record<string, unknown> = {}
      if (update.unit_cost !== undefined) {
        updateFields.unit_cost = update.unit_cost
        updateFields.cost_currency = 'GBP'
        const prevCost = current ? Number(current.unit_cost) : 0
        if (prevCost !== update.unit_cost) {
          changes.push({ itemName, field: 'cost', from: `£${prevCost.toFixed(2)}`, to: `£${update.unit_cost.toFixed(2)}` })
        }
      }
      if (update.par_level !== undefined) {
        updateFields.par_level = update.par_level
        const prevPar = current?.par_level ?? null
        if (prevPar !== update.par_level) {
          changes.push({ itemName, field: 'par', from: prevPar ?? 'none', to: update.par_level ?? 'none' })
        }
      }
      if (update.quantity !== undefined) {
        updateFields.quantity = update.quantity
        const prevQty = current?.quantity ?? 0
        if (prevQty !== update.quantity) {
          changes.push({ itemName, field: 'stock', from: prevQty, to: update.quantity })

          // Create stock_history record for quantity changes
          await admin
            .from('stock_history')
            .insert({
              store_id: storeId,
              inventory_item_id: update.itemId,
              action_type: 'Adjustment',
              quantity_before: prevQty,
              quantity_after: update.quantity,
              quantity_change: update.quantity - prevQty,
              performed_by: context.user.id,
              notes: 'Batch inventory update',
            })
            .then(({ error }) => {
              if (error) logger.error('[StockHistory] Failed to write:', { error: error })
            })
        }
      }

      if (Object.keys(updateFields).length === 0) {
        results.push({ itemId: update.itemId, success: true })
        continue
      }

      // Update existing record or insert new one
      let opError: { message: string } | null = null
      if (current) {
        const { error } = await admin
          .from('store_inventory')
          .update(updateFields)
          .eq('store_id', storeId)
          .eq('inventory_item_id', update.itemId)
        opError = error
      } else {
        const { error } = await admin
          .from('store_inventory')
          .insert({
            store_id: storeId,
            inventory_item_id: update.itemId,
            quantity: update.quantity ?? 0,
            par_level: update.par_level !== undefined ? update.par_level : null,
            unit_cost: update.unit_cost ?? 0,
            cost_currency: 'GBP',
          })
        opError = error
      }

      results.push({ itemId: update.itemId, success: !opError })
      if (opError) {
        logger.error(`[BatchUpdate] Failed for item ${update.itemId}:`, opError)
      }
    }

    // Create ONE audit log entry summarizing all changes
    if (changes.length > 0) {
      await auditLog(admin, {
        userId: context.user.id,
        userEmail: context.user.email,
        action: 'inventory.batch_update',
        storeId,
        resourceType: 'inventory',
        details: {
          itemCount: new Set(changes.map(c => c.itemName)).size,
          changeCount: changes.length,
          changes: changes.slice(0, 50), // Cap at 50 to avoid huge payloads
          summary: buildChangeSummary(changes),
        },
        request,
      })
    }

    const successCount = results.filter(r => r.success).length

    return apiSuccess(
      { updated: successCount, total: updates.length, changes: changes.length },
      { requestId: context.requestId }
    )
  } catch (error) {
    logger.error('Error batch updating inventory:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to batch update inventory')
  }
}

const batchDeleteSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1, 'At least one item ID is required').max(200),
})

/**
 * DELETE /api/stores/:storeId/inventory/batch - Batch delete multiple inventory items
 *
 * Soft-deletes inventory_items rows, cleans up store_inventory and recipe_ingredients,
 * and creates a single audit log entry listing all deleted items.
 * Returns { setupReset: true } if all inventory is now gone and setup_completed_at was cleared.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
      return apiForbidden('You do not have permission to delete inventory items', context.requestId)
    }

    const body = await request.json()
    const validation = batchDeleteSchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const { itemIds } = validation.data
    const admin = createAdminClient()

    // Fetch item names before deleting for the audit log
    const { data: itemRecords } = await admin
      .from('inventory_items')
      .select('id, name, category')
      .in('id', itemIds)

    const deletedItems = (itemRecords || []).map(r => ({
      name: r.name,
      category: r.category,
    }))

    // 1. Clean up operational data
    await Promise.all([
      admin.from('store_inventory').delete().in('inventory_item_id', itemIds),
      admin.from('recipe_ingredients').delete().in('inventory_item_id', itemIds),
    ])

    // 2. Soft-delete inventory_items rows (historical FKs remain valid)
    //    CASCADE FKs auto-clean: inventory_item_tags, supplier_items, pos_item_mappings
    const { error: updateError } = await admin
      .from('inventory_items')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('id', itemIds)

    if (updateError) throw updateError

    // 3. Create ONE audit log entry
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'inventory.bulk_delete',
      storeId,
      resourceType: 'inventory',
      details: {
        itemCount: deletedItems.length,
        items: deletedItems.slice(0, 50), // Cap to avoid huge payloads
        summary: `Deleted ${deletedItems.length} item${deletedItems.length !== 1 ? 's' : ''} from inventory`,
      },
      request,
    })

    // 4. Check if any inventory remains — if not, clear setup_completed_at
    let setupReset = false
    const { count: remainingCount } = await admin
      .from('store_inventory')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)

    if (remainingCount === 0) {
      await (admin.from('stores') as ReturnType<typeof admin.from>)
        .update({ setup_completed_at: null } as Record<string, unknown>)
        .eq('id', storeId)
      setupReset = true
    }

    return apiSuccess(
      { deleted: deletedItems.length, setupReset },
      { requestId: context.requestId }
    )
  } catch (error) {
    logger.error('Error batch deleting inventory:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to batch delete inventory')
  }
}

/**
 * Build a human-readable summary of batch changes
 */
function buildChangeSummary(changes: Array<{ itemName: string; field: string; from: unknown; to: unknown }>): string {
  const stockChanges = changes.filter(c => c.field === 'stock')
  const parChanges = changes.filter(c => c.field === 'par')
  const costChanges = changes.filter(c => c.field === 'cost')

  const parts: string[] = []
  if (stockChanges.length > 0) parts.push(`${stockChanges.length} stock level${stockChanges.length !== 1 ? 's' : ''}`)
  if (parChanges.length > 0) parts.push(`${parChanges.length} PAR level${parChanges.length !== 1 ? 's' : ''}`)
  if (costChanges.length > 0) parts.push(`${costChanges.length} cost${costChanges.length !== 1 ? 's' : ''}`)

  return `Updated ${parts.join(', ')} across ${new Set(changes.map(c => c.itemName)).size} item${new Set(changes.map(c => c.itemName)).size !== 1 ? 's' : ''}`
}
