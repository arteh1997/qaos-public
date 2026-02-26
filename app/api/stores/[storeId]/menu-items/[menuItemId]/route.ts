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
import { updateMenuItemSchema } from '@/lib/validations/recipes'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog, computeFieldChanges } from '@/lib/audit'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string; menuItemId: string }>
}

/**
 * PUT /api/stores/:storeId/menu-items/:menuItemId - Update menu item
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, menuItemId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to update menu items', context.requestId)
    }

    const body = await request.json()
    const validation = updateMenuItemSchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    // Fetch current state for before/after tracking
    const { data: beforeMenuItem } = await context.supabase
      .from('menu_items')
      .select('*')
      .eq('id', menuItemId)
      .eq('store_id', storeId)
      .single()

    const { data, error } = await context.supabase
      .from('menu_items')
      .update(validation.data)
      .eq('id', menuItemId)
      .eq('store_id', storeId)
      .select()
      .single()

    if (error || !data) {
      return apiNotFound('Menu item', context.requestId)
    }

    const admin = createAdminClient()
    const fieldChanges = beforeMenuItem
      ? computeFieldChanges(beforeMenuItem, validation.data)
      : []
    void auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'inventory.menu_item_update',
      storeId,
      resourceType: 'menu_item',
      resourceId: menuItemId,
      details: { menuItemName: data.name, updatedFields: Object.keys(validation.data), fieldChanges },
      request,
    }).catch(err => logger.error('Audit log error:', { error: err }))

    return apiSuccess(data, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error updating menu item:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to update menu item')
  }
}

/**
 * DELETE /api/stores/:storeId/menu-items/:menuItemId - Delete menu item
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, menuItemId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to delete menu items', context.requestId)
    }

    // Fetch menu item name before deleting for audit log
    const { data: menuItemToDelete } = await context.supabase
      .from('menu_items')
      .select('name')
      .eq('id', menuItemId)
      .eq('store_id', storeId)
      .single()

    const { error } = await context.supabase
      .from('menu_items')
      .delete()
      .eq('id', menuItemId)
      .eq('store_id', storeId)

    if (error) {
      return apiError('Failed to delete menu item')
    }

    const admin = createAdminClient()
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'inventory.menu_item_delete',
      storeId,
      resourceType: 'menu_item',
      resourceId: menuItemId,
      details: { menuItemName: menuItemToDelete?.name || menuItemId },
      request,
    })

    return apiSuccess({ message: 'Menu item deleted successfully' }, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error deleting menu item:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to delete menu item')
  }
}
