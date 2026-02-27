/**
 * Stock Operations Service
 *
 * Shared logic for stock counts and stock reception operations.
 * Eliminates duplication between stock-count and stock-reception routes.
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface StockOperationItem {
  inventory_item_id: string
  quantity: number
}

export interface StockOperationResult {
  itemsUpdated: number
  date: string
}

export interface InventoryUpdate {
  store_id: string
  inventory_item_id: string
  quantity: number
  last_updated_at: string
  last_updated_by: string
}

export interface StockHistoryInsert {
  store_id: string
  inventory_item_id: string
  action_type: 'Count' | 'Reception' | 'Sale' | 'Waste' | 'Adjustment'
  quantity_before: number
  quantity_after: number
  quantity_change: number
  performed_by: string
  notes: string | null
}

/**
 * Verify that all inventory items are active (not soft-deleted)
 *
 * @throws Error if any items have been deleted
 */
export async function verifyActiveItems(
  supabase: SupabaseClient,
  itemIds: string[],
  requestId: string
): Promise<void> {
  if (itemIds.length === 0) return

  const { data: activeItems } = await supabase
    .from('inventory_items')
    .select('id')
    .in('id', itemIds)
    .eq('is_active', true)

  const activeItemIds = new Set(
    (activeItems ?? []).map((item: { id: string }) => item.id)
  )

  const deletedItemIds = itemIds.filter(id => !activeItemIds.has(id))

  if (deletedItemIds.length > 0) {
    throw new Error(
      `Some items have been deleted and cannot be processed. Please refresh the page to see the current inventory list.`
    )
  }
}

/**
 * Fetch current inventory quantities for items at a store
 *
 * @param itemIds - Optional list of item IDs to filter by. If omitted, fetches all items.
 * @returns Map of inventory_item_id → current quantity
 */
export async function getCurrentInventoryMap(
  supabase: SupabaseClient,
  storeId: string,
  itemIds?: string[]
): Promise<Map<string, number>> {
  let query = supabase
    .from('store_inventory')
    .select('inventory_item_id, quantity')
    .eq('store_id', storeId)

  if (itemIds && itemIds.length > 0) {
    query = query.in('inventory_item_id', itemIds)
  }

  const { data: currentInventory } = await query

  return new Map(
    (currentInventory ?? []).map((item: { inventory_item_id: string; quantity: number }) => [
      item.inventory_item_id,
      item.quantity,
    ])
  )
}

/**
 * Prepare inventory update records for upsert
 */
export function prepareInventoryUpdates(
  items: StockOperationItem[],
  storeId: string,
  userId: string,
  timestamp: string
): InventoryUpdate[] {
  return items.map(item => ({
    store_id: storeId,
    inventory_item_id: item.inventory_item_id,
    quantity: item.quantity,
    last_updated_at: timestamp,
    last_updated_by: userId,
  }))
}

/**
 * Prepare stock history insert records
 */
export function prepareHistoryInserts(
  items: StockOperationItem[],
  currentInventoryMap: Map<string, number>,
  storeId: string,
  userId: string,
  actionType: 'Count' | 'Reception' | 'Sale' | 'Waste' | 'Adjustment',
  notes: string | null
): StockHistoryInsert[] {
  return items.map(item => {
    const quantityBefore = currentInventoryMap.get(item.inventory_item_id) ?? 0
    return {
      store_id: storeId,
      inventory_item_id: item.inventory_item_id,
      action_type: actionType,
      quantity_before: quantityBefore,
      quantity_after: item.quantity,
      quantity_change: item.quantity - quantityBefore,
      performed_by: userId,
      notes,
    }
  })
}

/**
 * Verify user still has access to store (prevents TOCTOU vulnerabilities)
 *
 * @throws Error if access has been revoked
 */
export async function verifyStoreAccess(
  supabase: SupabaseClient,
  storeId: string,
  userId: string
): Promise<void> {
  const { data: currentAccess } = await supabase
    .from('store_users')
    .select('id')
    .eq('store_id', storeId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!currentAccess) {
    throw new Error('Your access to this store has been revoked')
  }
}

/**
 * Execute the full stock operation transaction
 *
 * Performs:
 * 1. Upsert inventory quantities
 * 2. Insert stock history records
 * 3. Mark daily count as complete (for Count operations)
 *
 * @returns Number of items updated
 */
export async function executeStockOperation(
  supabase: SupabaseClient,
  storeId: string,
  userId: string,
  inventoryUpdates: InventoryUpdate[],
  historyInserts: StockHistoryInsert[],
  markDailyCountComplete: boolean = false
): Promise<number> {
  // Upsert store inventory
  const { error: updateError } = await supabase
    .from('store_inventory')
    .upsert(inventoryUpdates, { onConflict: 'store_id,inventory_item_id' })

  if (updateError) {
    throw new Error(`Failed to update inventory: ${updateError.message}`)
  }

  // Insert stock history
  const { error: historyError } = await supabase
    .from('stock_history')
    .insert(historyInserts)

  if (historyError) {
    throw new Error(`Failed to record stock history: ${historyError.message}`)
  }

  // Mark daily count as complete (only for Count operations)
  if (markDailyCountComplete) {
    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()

    const { error: dailyCountError } = await supabase
      .from('daily_counts')
      .upsert(
        {
          store_id: storeId,
          count_date: today,
          submitted_by: userId,
          submitted_at: now,
        },
        { onConflict: 'store_id,count_date' }
      )

    if (dailyCountError) {
      throw new Error(`Failed to mark daily count: ${dailyCountError.message}`)
    }
  }

  return inventoryUpdates.length
}
