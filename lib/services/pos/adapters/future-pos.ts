import type { PosProviderAdapter, PosMenuItem } from '../types'
import type { PosSaleEvent } from '@/lib/services/pos'
import { validateFuturePosSignature } from '../webhook-validators'

/**
 * Future POS Adapter
 *
 * POS system for bars, nightclubs, and restaurants. Uses API key authentication.
 * API key is stored in the connection's credentials.
 */
export const futurePosAdapter: PosProviderAdapter = {
  provider: 'future_pos',
  name: 'Future POS',
  authType: 'api_key',

  // No OAuth for API key providers
  getAuthUrl: undefined,
  exchangeCode: undefined,
  refreshToken: undefined,

  validateSignature(payload: string, signature: string, secret: string): boolean {
    return validateFuturePosSignature(payload, signature, secret)
  },

  normalizeEvent(rawPayload: unknown): PosSaleEvent | null {
    const body = rawPayload as Record<string, unknown>
    const orderId = body.orderId as string || body.order_id as string || body.id as string
    if (!orderId) return null

    const items = (body.items as Record<string, unknown>[]) || (body.lineItems as Record<string, unknown>[]) || []
    return {
      external_event_id: String(orderId),
      event_type: body.type === 'refund' || body.isRefund ? 'refund' : 'sale',
      items: items.map(item => ({
        pos_item_id: String(item.itemId || item.id || item.productId || ''),
        pos_item_name: (item.name as string) || (item.itemName as string) || 'Unknown',
        quantity: Number(item.quantity) || 1,
        unit_price: item.price ? Number(item.price) / 100 : undefined,
      })),
      total_amount: body.total ? Number(body.total) / 100 : undefined,
      currency: 'USD',
      occurred_at: (body.createdAt as string) || (body.timestamp as string) || new Date().toISOString(),
    }
  },

  async fetchMenuItems(credentials: Record<string, unknown>): Promise<PosMenuItem[]> {
    const apiKey = credentials.api_key as string
    const res = await fetch('https://api.futurepos.com/v1/menu/items', {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`Future POS menu fetch failed: ${res.status}`)
    const data = await res.json()

    return ((data.items as Record<string, unknown>[]) || []).map(item => ({
      pos_item_id: String(item.id),
      pos_item_name: (item.name as string) || 'Unknown',
      category: (item.category as string) || undefined,
      price: item.price ? Number(item.price) / 100 : undefined,
      currency: 'USD',
    }))
  },
}
