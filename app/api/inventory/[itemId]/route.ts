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

    return apiSuccess(item as InventoryItem, { requestId: context.requestId })
  } catch (error) {
    console.error('Error getting inventory item:', error)
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

    // Validate input (partial)
    const validationResult = inventoryItemSchema.partial().safeParse(body)
    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    // Check for duplicate name if name is being updated
    if (validationResult.data.name) {
      const { data: existing } = await context.supabase
        .from('inventory_items')
        .select('id')
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

    return apiSuccess(item as InventoryItem, { requestId: context.requestId })
  } catch (error) {
    console.error('Error updating inventory item:', error)
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

    return apiSuccess(
      { message: 'Inventory item deactivated', item: item as InventoryItem },
      { requestId: context.requestId }
    )
  } catch (error) {
    console.error('Error deleting inventory item:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to delete inventory item')
  }
}
