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

    return apiSuccess(data, { requestId: context.requestId })
  } catch (error) {
    console.error('Error updating menu item:', error)
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

    const { error } = await context.supabase
      .from('menu_items')
      .delete()
      .eq('id', menuItemId)
      .eq('store_id', storeId)

    if (error) {
      return apiError('Failed to delete menu item')
    }

    return apiSuccess({ message: 'Menu item deleted successfully' }, { requestId: context.requestId })
  } catch (error) {
    console.error('Error deleting menu item:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to delete menu item')
  }
}
