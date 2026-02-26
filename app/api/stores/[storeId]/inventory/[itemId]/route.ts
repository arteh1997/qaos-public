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
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import { z } from 'zod'
import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string; itemId: string }>
}

const updateInventorySchema = z.object({
  unit_cost: z.number().min(0, 'Cost cannot be negative').optional(),
  par_level: z.number().int().min(0, 'PAR level cannot be negative').nullable().optional(),
  quantity: z.number().int().min(0, 'Quantity cannot be negative').optional(),
}).refine(data => data.unit_cost !== undefined || data.par_level !== undefined || data.quantity !== undefined, {
  message: 'At least one field (unit_cost, par_level, or quantity) is required',
})

/**
 * PATCH /api/stores/:storeId/inventory/:itemId - Update inventory item fields
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, itemId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to update inventory items', context.requestId)
    }

    const body = await request.json()
    const validation = updateInventorySchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    // If quantity is being changed, fetch current quantity for stock_history
    let quantityBefore: number | null = null
    if (validation.data.quantity !== undefined) {
      const { data: current } = await context.supabase
        .from('store_inventory')
        .select('quantity')
        .eq('store_id', storeId)
        .eq('inventory_item_id', itemId)
        .maybeSingle()

      quantityBefore = current?.quantity ?? 0
    }

    // Build update object dynamically based on what was provided
    const updateFields: Record<string, unknown> = {}
    if (validation.data.unit_cost !== undefined) {
      updateFields.unit_cost = validation.data.unit_cost
      updateFields.cost_currency = 'GBP'
    }
    if (validation.data.par_level !== undefined) {
      updateFields.par_level = validation.data.par_level
    }
    if (validation.data.quantity !== undefined) {
      updateFields.quantity = validation.data.quantity
    }

    const { data, error } = await context.supabase
      .from('store_inventory')
      .update(updateFields)
      .eq('store_id', storeId)
      .eq('inventory_item_id', itemId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No store_inventory record yet — create one
        const { data: inserted, error: insertError } = await context.supabase
          .from('store_inventory')
          .insert({
            store_id: storeId,
            inventory_item_id: itemId,
            quantity: validation.data.quantity ?? 0,
            par_level: validation.data.par_level ?? null,
            unit_cost: validation.data.unit_cost ?? 0,
            cost_currency: 'GBP',
          })
          .select()
          .single()

        if (insertError) throw insertError

        // For new records, quantityBefore is 0
        if (validation.data.quantity !== undefined) {
          quantityBefore = 0
        }

        // Log stock_history and audit for new records too
        await logStockAndAudit(
          context.supabase,
          request,
          storeId,
          itemId,
          context.user.id,
          context.user.email,
          validation.data,
          quantityBefore
        )

        return apiSuccess(inserted, { requestId: context.requestId })
      }
      throw error
    }

    // Log stock_history and audit
    await logStockAndAudit(
      context.supabase,
      request,
      storeId,
      itemId,
      context.user.id,
      context.user.email,
      validation.data,
      quantityBefore
    )

    return apiSuccess(data, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error updating inventory item:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to update inventory item')
  }
}

/**
 * Log stock_history record (for quantity changes) and audit log entry
 */
async function logStockAndAudit(
  supabase: SupabaseClient,
  request: NextRequest,
  storeId: string,
  itemId: string,
  userId: string,
  userEmail: string | undefined,
  data: { quantity?: number; par_level?: number | null; unit_cost?: number },
  quantityBefore: number | null,
) {
  const admin = createAdminClient()

  // Insert stock_history record when quantity changes
  if (data.quantity !== undefined && quantityBefore !== null) {
    const quantityAfter = data.quantity
    const quantityChange = quantityAfter - quantityBefore

    // Only log if quantity actually changed
    if (quantityChange !== 0) {
      await admin
        .from('stock_history')
        .insert({
          store_id: storeId,
          inventory_item_id: itemId,
          action_type: 'Adjustment',
          quantity_before: quantityBefore,
          quantity_after: quantityAfter,
          quantity_change: quantityChange,
          performed_by: userId,
          notes: 'Inline stock adjustment',
        })
        .then(({ error }) => {
          if (error) logger.error('[StockHistory] Failed to write:', { error: error })
        })
    }
  }

  // Fetch item name for the audit log
  const { data: itemRecord } = await admin
    .from('inventory_items')
    .select('name')
    .eq('id', itemId)
    .maybeSingle()

  const itemName = itemRecord?.name || 'Unknown item'

  // Build audit details
  const details: Record<string, unknown> = { itemName }
  if (data.quantity !== undefined) {
    details.quantity = data.quantity
    if (quantityBefore !== null) details.previousQuantity = quantityBefore
  }
  if (data.par_level !== undefined) details.parLevel = data.par_level
  if (data.unit_cost !== undefined) details.unitCost = data.unit_cost

  // Determine audit action
  let action: string
  if (data.quantity !== undefined) {
    action = 'stock.adjustment'
  } else if (data.unit_cost !== undefined) {
    action = 'inventory.item_update'
  } else {
    action = 'inventory.item_update'
  }

  await auditLog(admin, {
    userId,
    userEmail,
    action,
    storeId,
    resourceType: 'inventory_item',
    resourceId: itemId,
    details,
    request,
  })
}

/**
 * DELETE /api/stores/:storeId/inventory/:itemId - Delete item from inventory
 *
 * Cleans up operational data (store_inventory, recipe_ingredients) and
 * soft-deletes the inventory_items row. Historical records (stock_history,
 * waste_log, purchase_order_items) are preserved for reporting.
 * CASCADE FKs (inventory_item_tags, supplier_items, pos_item_mappings) auto-clean.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, itemId } = await params

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

    // Use admin client to bypass RLS for cleanup
    const admin = createAdminClient()

    // Fetch item name before deleting for audit log
    const { data: item } = await admin
      .from('inventory_items')
      .select('name')
      .eq('id', itemId)
      .maybeSingle()

    // 1. Clean up operational data (item no longer in active use)
    await Promise.all([
      admin.from('store_inventory').delete().eq('inventory_item_id', itemId),
      admin.from('recipe_ingredients').delete().eq('inventory_item_id', itemId),
    ])

    // 2. Soft-delete inventory_items row so historical FKs remain valid
    //    (stock_history, waste_log, purchase_order_items preserved for reporting)
    //    CASCADE FKs auto-clean: inventory_item_tags, supplier_items, pos_item_mappings
    const { error: updateError } = await admin
      .from('inventory_items')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', itemId)

    if (updateError) throw updateError

    // Audit log the deletion
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'inventory.item_delete',
      storeId,
      resourceType: 'inventory_item',
      resourceId: itemId,
      details: { itemName: item?.name || 'Unknown' },
      request,
    })

    // If no inventory items remain for this store, clear setup_completed_at
    // so the owner is taken back through the setup wizard
    let setupReset = false
    const { count: remainingCount } = await admin
      .from('store_inventory')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)

    if (remainingCount === 0) {
      // setup_completed_at added in migration 051, not yet in generated types
      await (admin.from('stores') as ReturnType<typeof admin.from>)
        .update({ setup_completed_at: null } as Record<string, unknown>)
        .eq('id', storeId)
      setupReset = true
    }

    return apiSuccess(
      { message: 'Item deleted from inventory', setupReset },
      { requestId: context.requestId }
    )
  } catch (error) {
    logger.error('Error deleting inventory item:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to delete item')
  }
}
