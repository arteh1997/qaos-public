import type { PosProviderAdapter, PosMenuItem } from '../types'
import type { PosSaleEvent } from '@/lib/services/pos'
import { validateTouchBistroSignature } from '../webhook-validators'

/**
 * TouchBistro Adapter
 *
 * iPad POS popular with North American restaurants and bars.
 * Uses API key authentication.
 */
export const touchBistroAdapter: PosProviderAdapter = {
  provider: 'touchbistro',
  name: 'TouchBistro',
  authType: 'api_key',

  getAuthUrl: undefined,
  exchangeCode: undefined,
  refreshToken: undefined,

  validateSignature(payload: string, signature: string, secret: string): boolean {
    return validateTouchBistroSignature(payload, signature, secret)
  },

  normalizeEvent(rawPayload: unknown): PosSaleEvent | null {
    const body = rawPayload as Record<string, unknown>
    const orderId = body.order_id as string || body.bill_id as string
    if (!orderId) return null

    const items = (body.order_items as Record<string, unknown>[]) ||
                  (body.items as Record<string, unknown>[]) || []
    return {
      external_event_id: String(orderId),
      event_type: body.is_refund ? 'refund' : 'sale',
      items: items.map(item => ({
        pos_item_id: String(item.menu_item_id || item.id || ''),
        pos_item_name: (item.menu_item_name as string) || (item.name as string) || 'Unknown',
        quantity: Number(item.quantity) || 1,
        unit_price: item.price ? Number(item.price) : undefined,
      })),
      total_amount: body.total ? Number(body.total) : undefined,
      currency: (body.currency as string) || 'CAD',
      occurred_at: (body.closed_at as string) || (body.created_at as string) || new Date().toISOString(),
    }
  },

  async fetchMenuItems(credentials: Record<string, unknown>): Promise<PosMenuItem[]> {
    const res = await fetch('https://cloud.touchbistro.com/api/v1/menu-items', {
      headers: {
        Authorization: `Bearer ${credentials.api_key}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) throw new Error(`TouchBistro menu fetch failed: ${res.status}`)
    const data = await res.json()

    return ((data.menu_items as Record<string, unknown>[]) || []).map(item => ({
      pos_item_id: String(item.id),
      pos_item_name: (item.name as string) || 'Unknown',
      category: (item.category_name as string) || undefined,
      price: item.price ? Number(item.price) : undefined,
      currency: 'CAD',
    }))
  },
}
