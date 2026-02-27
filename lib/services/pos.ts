import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'
import type { PosProviderAdapter, PosProviderInfo } from '@/lib/services/pos/types'
import { squareAdapter } from '@/lib/services/pos/adapters/square'
import { toastAdapter } from '@/lib/services/pos/adapters/toast'
import { cloverAdapter } from '@/lib/services/pos/adapters/clover'
import { lightspeedAdapter } from '@/lib/services/pos/adapters/lightspeed'
import { zettleAdapter } from '@/lib/services/pos/adapters/zettle'
import { sumupAdapter } from '@/lib/services/pos/adapters/sumup'
import { eposNowAdapter } from '@/lib/services/pos/adapters/epos-now'
import { tevalisAdapter } from '@/lib/services/pos/adapters/tevalis'
import { foodicsAdapter } from '@/lib/services/pos/adapters/foodics'
import { oracleMicrosAdapter } from '@/lib/services/pos/adapters/oracle-micros'
import { ncrVoyixAdapter } from '@/lib/services/pos/adapters/ncr-voyix'
import { spotOnAdapter } from '@/lib/services/pos/adapters/spoton'
import { revelAdapter } from '@/lib/services/pos/adapters/revel'
import { touchBistroAdapter } from '@/lib/services/pos/adapters/touchbistro'
import { gastrofixAdapter } from '@/lib/services/pos/adapters/gastrofix'
import { iikoAdapter } from '@/lib/services/pos/adapters/iiko'
import { posRocketAdapter } from '@/lib/services/pos/adapters/posrocket'
import { parBrinkAdapter } from '@/lib/services/pos/adapters/par-brink'
import { heartlandAdapter } from '@/lib/services/pos/adapters/heartland'
import { hungerRushAdapter } from '@/lib/services/pos/adapters/hungerrush'
import { cakeAdapter } from '@/lib/services/pos/adapters/cake'
import { lavuAdapter } from '@/lib/services/pos/adapters/lavu'
import { focusPosAdapter } from '@/lib/services/pos/adapters/focus-pos'
import { shopifyPosAdapter } from '@/lib/services/pos/adapters/shopify-pos'
import { aldeloExpressAdapter } from '@/lib/services/pos/adapters/aldelo-express'
import { squirrelAdapter } from '@/lib/services/pos/adapters/squirrel'
import { goTabAdapter } from '@/lib/services/pos/adapters/gotab'
import { xenialAdapter } from '@/lib/services/pos/adapters/xenial'
import { quPosAdapter } from '@/lib/services/pos/adapters/qu-pos'
import { futurePosAdapter } from '@/lib/services/pos/adapters/future-pos'
import { upserveAdapter } from '@/lib/services/pos/adapters/upserve'
import { sicomAdapter } from '@/lib/services/pos/adapters/sicom'
import { posiTouchAdapter } from '@/lib/services/pos/adapters/positouch'
import { harbortouchAdapter } from '@/lib/services/pos/adapters/harbortouch'
import { digitalDiningAdapter } from '@/lib/services/pos/adapters/digital-dining'
import { maitredAdapter } from '@/lib/services/pos/adapters/maitred'
import { speedlineAdapter } from '@/lib/services/pos/adapters/speedline'
import { validateCustomSignature } from '@/lib/services/pos/webhook-validators'

/**
 * POS Integration Service
 *
 * Handles incoming sale events from POS systems, maps POS items to
 * inventory items, and automatically deducts stock.
 */

export type PosProvider =
  | 'square' | 'toast' | 'clover' | 'lightspeed' | 'zettle' | 'sumup' | 'epos_now' | 'tevalis'
  | 'foodics' | 'oracle_micros' | 'ncr_voyix' | 'spoton' | 'revel' | 'touchbistro' | 'gastrofix' | 'iiko' | 'posrocket'
  | 'par_brink' | 'heartland' | 'hungerrush' | 'cake' | 'lavu' | 'focus_pos' | 'shopify_pos' | 'aldelo_express'
  | 'squirrel' | 'gotab' | 'xenial' | 'qu_pos' | 'future_pos' | 'upserve' | 'sicom' | 'positouch'
  | 'harbortouch' | 'digital_dining' | 'maitred' | 'speedline'
  | 'custom'

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

export const POS_PROVIDERS: Record<string, PosProviderInfo> = {
  square: { name: 'Square', description: 'Square POS by Block', authType: 'oauth2', region: 'Global' },
  toast: { name: 'Toast', description: 'Toast POS for restaurants', authType: 'oauth2', region: 'US' },
  clover: { name: 'Clover', description: 'Clover POS by Fiserv', authType: 'oauth2', region: 'Global' },
  lightspeed: { name: 'Lightspeed', description: 'Lightspeed Restaurant POS', authType: 'oauth2', region: 'Global' },
  zettle: { name: 'Zettle', description: 'Zettle by PayPal — card reader & POS', authType: 'oauth2', region: 'UK & EU' },
  sumup: { name: 'SumUp', description: 'SumUp card payments & POS', authType: 'oauth2', region: 'UK & EU' },
  epos_now: { name: 'Epos Now', description: 'Epos Now cloud POS', authType: 'api_key', region: 'UK' },
  tevalis: { name: 'Tevalis', description: 'Tevalis hospitality technology', authType: 'api_key', region: 'UK' },
  foodics: { name: 'Foodics', description: 'Leading POS in Saudi Arabia & Gulf', authType: 'oauth2', region: 'Middle East' },
  oracle_micros: { name: 'Oracle MICROS', description: 'Oracle MICROS Simphony for enterprise', authType: 'api_key', region: 'Global' },
  ncr_voyix: { name: 'NCR Voyix (Aloha)', description: 'NCR Voyix Aloha POS', authType: 'api_key', region: 'North America' },
  spoton: { name: 'SpotOn', description: 'SpotOn restaurant POS & payments', authType: 'oauth2', region: 'North America' },
  revel: { name: 'Revel Systems', description: 'Cloud-native iPad POS', authType: 'oauth2', region: 'Global' },
  touchbistro: { name: 'TouchBistro', description: 'iPad POS for restaurants', authType: 'api_key', region: 'North America' },
  gastrofix: { name: 'Gastrofix', description: 'iPad POS for German hospitality', authType: 'api_key', region: 'Germany & EU' },
  iiko: { name: 'iiko', description: 'Restaurant management & POS', authType: 'api_key', region: 'Russia, CIS & Middle East' },
  posrocket: { name: 'POSRocket', description: 'Cloud POS for Middle East', authType: 'api_key', region: 'Middle East' },
  par_brink: { name: 'PAR Brink', description: 'Enterprise POS for multi-unit restaurants', authType: 'api_key', region: 'North America' },
  heartland: { name: 'Heartland', description: 'Heartland restaurant POS & payments', authType: 'api_key', region: 'North America' },
  hungerrush: { name: 'HungerRush', description: 'POS for pizza & quick service', authType: 'api_key', region: 'North America' },
  cake: { name: 'CAKE', description: 'CAKE POS by Mad Mobile', authType: 'oauth2', region: 'North America' },
  lavu: { name: 'Lavu', description: 'iPad POS for restaurants', authType: 'api_key', region: 'North America' },
  focus_pos: { name: 'Focus POS', description: 'Enterprise restaurant POS', authType: 'api_key', region: 'North America' },
  shopify_pos: { name: 'Shopify POS', description: 'Shopify retail & restaurant POS', authType: 'oauth2', region: 'Global' },
  aldelo_express: { name: 'Aldelo Express', description: 'Cloud POS for restaurants', authType: 'api_key', region: 'North America' },
  squirrel: { name: 'Squirrel Systems', description: 'Enterprise hospitality POS', authType: 'api_key', region: 'North America' },
  gotab: { name: 'GoTab', description: 'Order & pay platform', authType: 'oauth2', region: 'North America' },
  xenial: { name: 'Xenial', description: 'Xenial by Global Payments', authType: 'api_key', region: 'North America' },
  qu_pos: { name: 'Qu POS', description: 'Unified commerce for QSR', authType: 'api_key', region: 'North America' },
  future_pos: { name: 'Future POS', description: 'Full-service restaurant POS', authType: 'api_key', region: 'North America' },
  upserve: { name: 'Upserve', description: 'Upserve by Lightspeed', authType: 'oauth2', region: 'North America' },
  sicom: { name: 'SICOM', description: 'QSR & enterprise POS', authType: 'api_key', region: 'North America' },
  positouch: { name: 'POSitouch', description: 'Full-service restaurant POS', authType: 'api_key', region: 'North America' },
  harbortouch: { name: 'Harbortouch', description: 'Harbortouch by Shift4', authType: 'api_key', region: 'North America' },
  digital_dining: { name: 'Digital Dining', description: 'Digital Dining by Menusoft', authType: 'api_key', region: 'North America' },
  maitred: { name: "Maitre'D", description: "Maitre'D by PayFacto", authType: 'api_key', region: 'North America' },
  speedline: { name: 'Speedline', description: 'Pizza & delivery POS', authType: 'api_key', region: 'North America' },
  custom: { name: 'Custom', description: 'Custom POS via webhook', authType: 'api_key', region: 'Any' },
} as const

/**
 * Provider adapter registry — maps provider name to its adapter
 */
export const POS_ADAPTERS: Record<string, PosProviderAdapter> = {
  square: squareAdapter,
  toast: toastAdapter,
  clover: cloverAdapter,
  lightspeed: lightspeedAdapter,
  zettle: zettleAdapter,
  sumup: sumupAdapter,
  epos_now: eposNowAdapter,
  tevalis: tevalisAdapter,
  foodics: foodicsAdapter,
  oracle_micros: oracleMicrosAdapter,
  ncr_voyix: ncrVoyixAdapter,
  spoton: spotOnAdapter,
  revel: revelAdapter,
  touchbistro: touchBistroAdapter,
  gastrofix: gastrofixAdapter,
  iiko: iikoAdapter,
  posrocket: posRocketAdapter,
  par_brink: parBrinkAdapter,
  heartland: heartlandAdapter,
  hungerrush: hungerRushAdapter,
  cake: cakeAdapter,
  lavu: lavuAdapter,
  focus_pos: focusPosAdapter,
  shopify_pos: shopifyPosAdapter,
  aldelo_express: aldeloExpressAdapter,
  squirrel: squirrelAdapter,
  gotab: goTabAdapter,
  xenial: xenialAdapter,
  qu_pos: quPosAdapter,
  future_pos: futurePosAdapter,
  upserve: upserveAdapter,
  sicom: sicomAdapter,
  positouch: posiTouchAdapter,
  harbortouch: harbortouchAdapter,
  digital_dining: digitalDiningAdapter,
  maitred: maitredAdapter,
  speedline: speedlineAdapter,
}

/**
 * Get the adapter for a specific provider
 */
export function getAdapter(provider: string): PosProviderAdapter | null {
  return POS_ADAPTERS[provider] || null
}

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
      currency: event.currency ?? 'GBP',
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

  // 4. Batch process all sold items
  const multiplier = event.event_type === 'refund' ? -1 : 1

  // Step 1: Collect unique inventory_item_ids from mapped items
  const inventoryItemIds = [...new Set(
    event.items
      .map(item => mappingMap.get(item.pos_item_id)?.inventory_item_id)
      .filter((id): id is string => !!id)
  )]

  // Step 2: Batch-fetch current inventory in ONE query
  const inventoryMap = new Map<string, number>()
  if (inventoryItemIds.length > 0) {
    const { data: currentInventory } = await adminClient
      .from('store_inventory')
      .select('inventory_item_id, quantity')
      .eq('store_id', storeId)
      .in('inventory_item_id', inventoryItemIds)

    for (const row of currentInventory ?? []) {
      inventoryMap.set(row.inventory_item_id, row.quantity as number)
    }
  }

  // Step 3: Calculate all changes in memory (dedup multiple POS items → same inventory item)
  const changes = new Map<string, { deduction: number; notes: string[] }>()

  for (const soldItem of event.items) {
    const mapping = mappingMap.get(soldItem.pos_item_id)
    if (!mapping) {
      itemsSkipped++
      continue
    }

    const deductionAmount = soldItem.quantity * mapping.quantity_per_sale * multiplier
    const existing = changes.get(mapping.inventory_item_id)

    if (existing) {
      existing.deduction += deductionAmount
      existing.notes.push(`${soldItem.pos_item_name} x${soldItem.quantity}`)
    } else {
      changes.set(mapping.inventory_item_id, {
        deduction: deductionAmount,
        notes: [`${soldItem.pos_item_name} x${soldItem.quantity}`],
      })
    }

    itemsDeducted++
  }

  // Step 4: Batch upsert ALL inventory changes in ONE query
  if (changes.size > 0) {
    const upsertRows = [...changes.entries()].map(([inventoryItemId, change]) => {
      const currentQty = inventoryMap.get(inventoryItemId) ?? 0
      return {
        store_id: storeId,
        inventory_item_id: inventoryItemId,
        quantity: Math.max(0, currentQty - change.deduction),
        last_updated_at: new Date().toISOString(),
      }
    })

    const { error: upsertError } = await adminClient
      .from('store_inventory')
      .upsert(upsertRows, { onConflict: 'store_id,inventory_item_id' })

    if (upsertError) {
      itemsSkipped += itemsDeducted
      itemsDeducted = 0
    }
  }

  // Step 5: Batch insert ALL stock history records in ONE query
  if (itemsDeducted > 0 && changes.size > 0) {
    const historyRows = [...changes.entries()].map(([inventoryItemId, change]) => {
      const currentQty = inventoryMap.get(inventoryItemId) ?? 0
      const newQty = Math.max(0, currentQty - change.deduction)
      return {
        store_id: storeId,
        inventory_item_id: inventoryItemId,
        action_type: 'Sale' as const,
        quantity_before: currentQty,
        quantity_after: newQty,
        quantity_change: -(change.deduction),
        notes: `POS ${event.event_type}: ${change.notes.join(', ')}`,
      }
    })

    await adminClient.from('stock_history').insert(historyRows)
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
 * Validate a POS webhook signature using provider-specific adapter
 */
export function validateWebhookSignature(
  provider: PosProvider,
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (provider === 'custom') {
    // Custom webhooks use standard HMAC-SHA256
    return validateCustomSignature(payload, signature, secret)
  }

  const adapter = getAdapter(provider)
  if (!adapter) return false

  try {
    return adapter.validateSignature(payload, signature, secret)
  } catch {
    // If signature validation throws (e.g. buffer length mismatch), reject
    return false
  }
}
