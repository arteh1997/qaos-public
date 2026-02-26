import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiNotFound,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { inventoryItemSchema } from '@/lib/validations/inventory'
import { InventoryItem } from '@/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ itemId: string }>
}

/**
 * GET /api/inventory/:itemId - Get a single inventory item
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { itemId } = await params

    const auth = await withApiAuth(request, {
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth

    const { data: item, error } = await context.supabase
      .from('inventory_items')
      .select('*')
      .eq('id', itemId)
      .single()

    if (error || !item) {
      return apiNotFound('Inventory item', context.requestId)
    }

    // Verify user has access to this item's store
    const typedItem = item as unknown as InventoryItem
    const hasAccess = context.stores.some(s => s.store_id === typedItem.store_id)
    if (!hasAccess) {
      return apiNotFound('Inventory item', context.requestId)
    }

    return apiSuccess(typedItem, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error getting inventory item:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to get inventory item')
  }
}

/**
 * PATCH /api/inventory/:itemId - Update an inventory item
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { itemId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response

    const { context } = auth
    const body = await request.json()

    // First, verify the item exists and user has access to its store
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingRaw, error: fetchError } = await (context.supabase as any)
      .from('inventory_items')
      .select('id, store_id')
      .eq('id', itemId)
      .single()

    if (fetchError || !existingRaw) {
      return apiNotFound('Inventory item', context.requestId)
    }

    const existingItem = existingRaw as { id: string; store_id: string }
    const hasAccess = context.stores.some(s => s.store_id === existingItem.store_id)
    if (!hasAccess) {
      return apiNotFound('Inventory item', context.requestId)
    }

    // Validate input (partial)
    const validationResult = inventoryItemSchema.partial().safeParse(body)
    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    // Check for duplicate name within this store if name is being updated
    if (validationResult.data.name) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (context.supabase as any)
        .from('inventory_items')
        .select('id')
        .eq('store_id', existingItem.store_id)
        .ilike('name', validationResult.data.name)
        .neq('id', itemId)
        .single()

      if (existing) {
        return apiBadRequest(
          'An inventory item with this name already exists',
          context.requestId
        )
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: item, error } = await (context.supabase as any)
      .from('inventory_items')
      .update({
        ...validationResult.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return apiNotFound('Inventory item', context.requestId)
      }
      throw error
    }

    if (!item) {
      return apiNotFound('Inventory item', context.requestId)
    }

    const admin = createAdminClient()
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'inventory.item_update',
      storeId: item.store_id,
      resourceType: 'inventory_item',
      resourceId: itemId,
      details: {
        itemName: item.name,
        changes: validationResult.data,
      },
      request,
    })

    return apiSuccess(item as InventoryItem, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error updating inventory item:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to update inventory item')
  }
}

/**
 * DELETE /api/inventory/:itemId - Soft delete an inventory item
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { itemId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // First, verify the item exists and user has access to its store
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingRaw, error: fetchError } = await (context.supabase as any)
      .from('inventory_items')
      .select('id, store_id')
      .eq('id', itemId)
      .single()

    if (fetchError || !existingRaw) {
      return apiNotFound('Inventory item', context.requestId)
    }

    const existingItem = existingRaw as { id: string; store_id: string }
    const hasAccess = context.stores.some(s => s.store_id === existingItem.store_id)
    if (!hasAccess) {
      return apiNotFound('Inventory item', context.requestId)
    }

    // Soft delete by setting is_active to false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: item, error } = await (context.supabase as any)
      .from('inventory_items')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return apiNotFound('Inventory item', context.requestId)
      }
      throw error
    }

    if (!item) {
      return apiNotFound('Inventory item', context.requestId)
    }

    const admin = createAdminClient()
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'inventory.item_delete',
      storeId: item.store_id,
      resourceType: 'inventory_item',
      resourceId: itemId,
      details: {
        itemName: item.name,
        category: item.category ?? null,
      },
      request,
    })

    return apiSuccess(
      { message: 'Inventory item deactivated', item: item as InventoryItem },
      { requestId: context.requestId }
    )
  } catch (error) {
    logger.error('Error deleting inventory item:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to delete inventory item')
  }
}
