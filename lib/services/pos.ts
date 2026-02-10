import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'

/**
 * POS Integration Service
 *
 * Handles incoming sale events from POS systems, maps POS items to
 * inventory items, and automatically deducts stock.
 */

export type PosProvider = 'square' | 'toast' | 'clover' | 'lightspeed' | 'custom'

export interface PosSaleItem {
  pos_item_id: string
  pos_item_name: string
  quantity: number
  unit_price?: number
}

export interface PosSaleEvent {
  external_event_id: string
  event_type: 'sale' | 'refund' | 'void'
  items: PosSaleItem[]
  total_amount?: number
  currency?: string
  occurred_at: string
}

export interface ProcessResult {
  event_id: string
  status: 'processed' | 'failed' | 'skipped'
  items_deducted: number
  items_skipped: number
  error?: string
}

export const POS_PROVIDERS = {
  square: { name: 'Square', description: 'Square POS by Block' },
  toast: { name: 'Toast', description: 'Toast POS for restaurants' },
  clover: { name: 'Clover', description: 'Clover POS by Fiserv' },
  lightspeed: { name: 'Lightspeed', description: 'Lightspeed Restaurant POS' },
  custom: { name: 'Custom', description: 'Custom POS via webhook' },
} as const

/**
 * Process a sale event from a POS system
 * 1. Check for duplicate (idempotent)
 * 2. Look up item mappings
 * 3. Deduct inventory
 * 4. Record stock history
 */
export async function processSaleEvent(
  connectionId: string,
  storeId: string,
  event: PosSaleEvent
): Promise<ProcessResult> {
  const adminClient = createAdminClient()

  // 1. Check for duplicate event (idempotent)
  const { data: existing } = await adminClient
    .from('pos_sale_events')
    .select('id, status')
    .eq('pos_connection_id', connectionId)
    .eq('external_event_id', event.external_event_id)
    .maybeSingle()

  if (existing) {
    return {
      event_id: existing.id,
      status: 'skipped',
      items_deducted: 0,
      items_skipped: 0,
      error: 'Duplicate event',
    }
  }

  // 2. Record the event
  const { data: saleEvent, error: insertError } = await adminClient
    .from('pos_sale_events')
    .insert({
      pos_connection_id: connectionId,
      store_id: storeId,
      external_event_id: event.external_event_id,
      event_type: event.event_type,
      items: event.items as unknown as Json,
      total_amount: event.total_amount ?? null,
      currency: event.currency ?? 'USD',
      occurred_at: event.occurred_at,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError || !saleEvent) {
    return {
      event_id: '',
      status: 'failed',
      items_deducted: 0,
      items_skipped: 0,
      error: insertError?.message ?? 'Failed to record event',
    }
  }

  // 3. Look up item mappings for all POS items
  const posItemIds = event.items.map(i => i.pos_item_id)

  const { data: mappings } = await adminClient
    .from('pos_item_mappings')
    .select('pos_item_id, inventory_item_id, quantity_per_sale')
    .eq('pos_connection_id', connectionId)
    .eq('is_active', true)
    .in('pos_item_id', posItemIds)

  const mappingMap = new Map(
    (mappings ?? []).map(m => [m.pos_item_id, m])
  )

  let itemsDeducted = 0
  let itemsSkipped = 0

  // 4. Process each sold item
  for (const soldItem of event.items) {
    const mapping = mappingMap.get(soldItem.pos_item_id)

    if (!mapping) {
      itemsSkipped++
      continue
    }

    // Calculate deduction amount
    const multiplier = event.event_type === 'refund' ? -1 : 1
    const deductionAmount = soldItem.quantity * mapping.quantity_per_sale * multiplier

    // Get current inventory quantity
    const { data: current } = await adminClient
      .from('store_inventory')
      .select('quantity')
      .eq('store_id', storeId)
      .eq('inventory_item_id', mapping.inventory_item_id)
      .single()

    const currentQty = current?.quantity ?? 0
    const newQty = Math.max(0, currentQty - deductionAmount)

    // Update inventory
    const { error: updateError } = await adminClient
      .from('store_inventory')
      .upsert({
        store_id: storeId,
        inventory_item_id: mapping.inventory_item_id,
        quantity: newQty,
        last_updated_at: new Date().toISOString(),
      }, {
        onConflict: 'store_id,inventory_item_id',
      })

    if (updateError) {
      itemsSkipped++
      continue
    }

    // Record stock history
    await adminClient
      .from('stock_history')
      .insert({
        store_id: storeId,
        inventory_item_id: mapping.inventory_item_id,
        action_type: 'Sale',
        quantity_before: currentQty,
        quantity_after: newQty,
        quantity_change: -(deductionAmount),
        notes: `POS ${event.event_type}: ${soldItem.pos_item_name} x${soldItem.quantity}`,
      })

    itemsDeducted++
  }

  // 5. Update event status
  const finalStatus = itemsSkipped > 0 && itemsDeducted === 0 ? 'failed' : 'processed'
  await adminClient
    .from('pos_sale_events')
    .update({
      status: finalStatus,
      processed_at: new Date().toISOString(),
      error_message: itemsSkipped > 0 ? `${itemsSkipped} items had no mapping` : null,
    })
    .eq('id', saleEvent.id)

  // Update connection sync timestamp
  await adminClient
    .from('pos_connections')
    .update({
      last_synced_at: new Date().toISOString(),
      sync_status: 'synced',
      sync_error: null,
    })
    .eq('id', connectionId)

  return {
    event_id: saleEvent.id,
    status: finalStatus,
    items_deducted: itemsDeducted,
    items_skipped: itemsSkipped,
  }
}

/**
 * Validate a POS webhook signature (provider-specific)
 */
export function validateWebhookSignature(
  provider: PosProvider,
  _payload: string,
  _signature: string,
  _secret: string
): boolean {
  // For custom webhooks, we use the same HMAC-SHA256 as our own webhooks
  // For real POS providers, each has their own signature scheme
  // This is a placeholder for provider-specific validation
  switch (provider) {
    case 'square':
    case 'toast':
    case 'clover':
    case 'lightspeed':
    case 'custom':
      // In production, implement provider-specific signature validation
      // For now, return true (validation handled at the route level via connection credentials)
      return true
    default:
      return false
  }
}
