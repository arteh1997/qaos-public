import type { PosProviderAdapter, PosMenuItem } from '../types'
import type { PosSaleEvent } from '@/lib/services/pos'
import { validatePosRocketSignature } from '../webhook-validators'

/**
 * POSRocket Adapter
 *
 * Cloud POS popular in the Middle East (Saudi Arabia, UAE, Jordan).
 * Uses API key authentication.
 */
export const posRocketAdapter: PosProviderAdapter = {
  provider: 'posrocket',
  name: 'POSRocket',
  authType: 'api_key',

  getAuthUrl: undefined,
  exchangeCode: undefined,
  refreshToken: undefined,

  validateSignature(payload: string, signature: string, secret: string): boolean {
    return validatePosRocketSignature(payload, signature, secret)
  },

  normalizeEvent(rawPayload: unknown): PosSaleEvent | null {
    const body = rawPayload as Record<string, unknown>
    const orderId = body.order_id as string || body.receipt_number as string
    if (!orderId) return null

    const items = (body.line_items as Record<string, unknown>[]) ||
                  (body.items as Record<string, unknown>[]) || []
    return {
      external_event_id: String(orderId),
      event_type: body.type === 'refund' ? 'refund' : 'sale',
      items: items.map(item => ({
        pos_item_id: (item.item_id as string) || (item.id as string) || '',
        pos_item_name: (item.item_name as string) || (item.name as string) || 'Unknown',
        quantity: Number(item.quantity) || 1,
        unit_price: item.price ? Number(item.price) : undefined,
      })),
      total_amount: body.total ? Number(body.total) : undefined,
      currency: (body.currency as string) || 'SAR',
      occurred_at: (body.created_at as string) || new Date().toISOString(),
    }
  },

  async fetchMenuItems(credentials: Record<string, unknown>): Promise<PosMenuItem[]> {
    const res = await fetch('https://api.posrocket.com/v1/items', {
      headers: {
        Authorization: `Bearer ${credentials.api_key}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) throw new Error(`POSRocket items fetch failed: ${res.status}`)
    const data = await res.json()

    return ((data.data as Record<string, unknown>[]) || []).map(item => ({
      pos_item_id: (item.id as string) || '',
      pos_item_name: (item.name as string) || 'Unknown',
      category: (item.category_name as string) || undefined,
      price: item.price ? Number(item.price) : undefined,
      currency: 'SAR',
    }))
  },
}
