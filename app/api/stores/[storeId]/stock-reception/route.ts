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
      allowedRoles: ['Admin', 'Driver'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // Check store access (Admin and Driver have global access)
    if (!canAccessStore(context.profile, storeId)) {
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
    const inventoryUpdates = validItems.map(item => {
      const quantityBefore = currentMap.get(item.inventory_item_id) ?? 0
      return {
        store_id: storeId,
        inventory_item_id: item.inventory_item_id,
        quantity: quantityBefore + item.quantity,
        last_updated_at: now,
        last_updated_by: context.user.id,
      }
    })

    const historyInserts = validItems.map(item => {
      const quantityBefore = currentMap.get(item.inventory_item_id) ?? 0
      return {
        store_id: storeId,
        inventory_item_id: item.inventory_item_id,
        action_type: 'Reception' as const,
        quantity_before: quantityBefore,
        quantity_after: quantityBefore + item.quantity,
        quantity_change: item.quantity,
        performed_by: context.user.id,
        notes: sanitizedNotes,
      }
    })

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

    return apiSuccess(
      {
        message: 'Stock reception recorded successfully',
        itemsReceived: validItems.length,
        totalQuantity: validItems.reduce((sum, item) => sum + item.quantity, 0),
      },
      { requestId: context.requestId, status: 201 }
    )
  } catch (error) {
    console.error('Error recording stock reception:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to record stock reception')
  }
}
