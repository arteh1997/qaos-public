import type { PosProviderAdapter, PosMenuItem } from '../types'
import type { PosSaleEvent } from '@/lib/services/pos'
import { validateNcrVoyixSignature } from '../webhook-validators'

/**
 * NCR Voyix (Aloha) Adapter
 *
 * Dominant in North American full-service restaurants (Aloha POS).
 * Uses API key authentication.
 * API docs: https://developer.ncr.com/
 */
export const ncrVoyixAdapter: PosProviderAdapter = {
  provider: 'ncr_voyix',
  name: 'NCR Voyix (Aloha)',
  authType: 'api_key',

  getAuthUrl: undefined,
  exchangeCode: undefined,
  refreshToken: undefined,

  validateSignature(payload: string, signature: string, secret: string): boolean {
    return validateNcrVoyixSignature(payload, signature, secret)
  },

  normalizeEvent(rawPayload: unknown): PosSaleEvent | null {
    const body = rawPayload as Record<string, unknown>
    const orderId = body.orderId as string || body.checkNumber as string
    if (!orderId) return null

    const lineItems = (body.orderLines as Record<string, unknown>[]) ||
                      (body.items as Record<string, unknown>[]) || []
    return {
      external_event_id: String(orderId),
      event_type: body.isVoided ? 'void' : (body.isRefund ? 'refund' : 'sale'),
      items: lineItems.map(item => ({
        pos_item_id: String(item.itemId || item.plu || ''),
        pos_item_name: (item.itemName as string) || (item.description as string) || 'Unknown',
        quantity: Number(item.quantity) || 1,
        unit_price: item.price ? Number(item.price) : undefined,
      })),
      total_amount: body.totalAmount ? Number(body.totalAmount) : undefined,
      currency: 'USD',
      occurred_at: (body.closedDateTime as string) || (body.businessDate as string) || new Date().toISOString(),
    }
  },

  async fetchMenuItems(credentials: Record<string, unknown>): Promise<PosMenuItem[]> {
    const baseUrl = (credentials.base_url as string) || 'https://api.ncr.com'
    const res = await fetch(`${baseUrl}/order/3/sites/${credentials.site_id}/menu-items`, {
      headers: {
        Authorization: `AccessKey ${credentials.api_key}:${credentials.shared_key}`,
        'nep-organization': credentials.organization as string || '',
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) throw new Error(`NCR Voyix menu fetch failed: ${res.status}`)
    const data = await res.json()

    return ((data.items as Record<string, unknown>[]) || []).map(item => ({
      pos_item_id: String(item.itemId || item.plu),
      pos_item_name: (item.name as string) || (item.description as string) || 'Unknown',
      category: (item.category as string) || undefined,
      price: item.price ? Number(item.price) : undefined,
      currency: 'USD',
    }))
  },
}
