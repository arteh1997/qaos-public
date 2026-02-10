import { createAdminClient } from '@/lib/supabase/admin'
import { signWebhookPayload } from '@/lib/api/api-keys'
import type { Json } from '@/types/database'

/**
 * Webhook Event Types
 */
export const WEBHOOK_EVENTS = {
  'inventory.item_created': 'When a new inventory item is added',
  'inventory.item_updated': 'When an inventory item is modified',
  'inventory.item_deleted': 'When an inventory item is removed',
  'stock.counted': 'When a stock count is submitted',
  'stock.received': 'When a stock reception is recorded',
  'stock.low_alert': 'When stock falls below PAR level',
  'waste.recorded': 'When waste is logged',
  'purchase_order.created': 'When a new PO is created',
  'purchase_order.status_changed': 'When a PO status changes',
  'purchase_order.received': 'When a PO is received',
} as const

export type WebhookEventType = keyof typeof WEBHOOK_EVENTS

/**
 * Dispatch a webhook event to all registered endpoints for a store
 */
export async function dispatchWebhookEvent(
  storeId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  const adminClient = createAdminClient()

  // Find all active webhook endpoints for this store that subscribe to this event
  const { data: endpoints, error } = await adminClient
    .from('webhook_endpoints')
    .select('id, url, secret, events')
    .eq('store_id', storeId)
    .eq('is_active', true)

  if (error || !endpoints || endpoints.length === 0) {
    return
  }

  const matchingEndpoints = endpoints.filter(ep =>
    ep.events.includes(eventType) || ep.events.includes('*')
  )

  if (matchingEndpoints.length === 0) return

  const payload = {
    id: crypto.randomUUID(),
    type: eventType,
    store_id: storeId,
    created_at: new Date().toISOString(),
    data,
  }

  const payloadStr = JSON.stringify(payload)

  // Deliver to each endpoint
  const deliveries = matchingEndpoints.map(async (endpoint) => {
    const signature = signWebhookPayload(payloadStr, endpoint.secret)

    // Create delivery record
    const { data: delivery } = await adminClient
      .from('webhook_deliveries')
      .insert({
        webhook_endpoint_id: endpoint.id,
        store_id: storeId,
        event_type: eventType,
        payload: payload as unknown as Json,
        status: 'pending',
        attempt_count: 0,
      })
      .select('id')
      .single()

    const deliveryId = delivery?.id

    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': eventType,
          'X-Webhook-ID': payload.id,
        },
        body: payloadStr,
        signal: AbortSignal.timeout(10000), // 10s timeout
      })

      const responseBody = await response.text().catch(() => '')

      if (deliveryId) {
        await adminClient
          .from('webhook_deliveries')
          .update({
            status: response.ok ? 'delivered' : 'failed',
            response_status: response.status,
            response_body: responseBody.slice(0, 1000),
            attempt_count: 1,
            last_attempt_at: new Date().toISOString(),
            ...(response.ok ? { delivered_at: new Date().toISOString() } : {}),
          })
          .eq('id', deliveryId)
      }
    } catch (err) {
      if (deliveryId) {
        await adminClient
          .from('webhook_deliveries')
          .update({
            status: 'failed',
            response_body: err instanceof Error ? err.message : 'Delivery failed',
            attempt_count: 1,
            last_attempt_at: new Date().toISOString(),
          })
          .eq('id', deliveryId)
      }
    }
  })

  // Fire all deliveries in parallel, don't block the caller
  await Promise.allSettled(deliveries)
}
