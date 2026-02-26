import type { PosProviderAdapter, PosMenuItem } from '../types'
import type { PosSaleEvent } from '@/lib/services/pos'
import { validateIikoSignature } from '../webhook-validators'

/**
 * iiko Adapter
 *
 * Leading POS in Russia, CIS, and Middle East markets.
 * Uses API key authentication (iiko Web API).
 */
export const iikoAdapter: PosProviderAdapter = {
  provider: 'iiko',
  name: 'iiko',
  authType: 'api_key',

  getAuthUrl: undefined,
  exchangeCode: undefined,
  refreshToken: undefined,

  validateSignature(payload: string, signature: string, secret: string): boolean {
    return validateIikoSignature(payload, signature, secret)
  },

  normalizeEvent(rawPayload: unknown): PosSaleEvent | null {
    const body = rawPayload as Record<string, unknown>
    const orderId = body.orderId as string || body.order_id as string
    if (!orderId) return null

    const items = (body.items as Record<string, unknown>[]) ||
                  (body.orderItems as Record<string, unknown>[]) || []
    return {
      external_event_id: String(orderId),
      event_type: body.isStorned ? 'void' : 'sale',
      items: items.map(item => ({
        pos_item_id: (item.productId as string) || (item.id as string) || '',
        pos_item_name: (item.productName as string) || (item.name as string) || 'Unknown',
        quantity: Number(item.amount || item.quantity) || 1,
        unit_price: item.price ? Number(item.price) : undefined,
      })),
      total_amount: body.sum ? Number(body.sum) : undefined,
      currency: (body.currency as string) || 'RUB',
      occurred_at: (body.whenClosed as string) || (body.created_at as string) || new Date().toISOString(),
    }
  },

  async fetchMenuItems(credentials: Record<string, unknown>): Promise<PosMenuItem[]> {
    // iiko requires a session token first
    const baseUrl = (credentials.base_url as string) || 'https://api-ru.iiko.services'
    const tokenRes = await fetch(`${baseUrl}/api/1/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiLogin: credentials.api_key }),
    })
    if (!tokenRes.ok) throw new Error(`iiko auth failed: ${tokenRes.status}`)
    const tokenData = await tokenRes.json()
    const token = tokenData.token as string

    const res = await fetch(`${baseUrl}/api/1/nomenclature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationId: credentials.organization_id }),
    })
    if (!res.ok) throw new Error(`iiko nomenclature fetch failed: ${res.status}`)
    const data = await res.json()

    return ((data.products as Record<string, unknown>[]) || []).map(product => ({
      pos_item_id: product.id as string,
      pos_item_name: (product.name as string) || 'Unknown',
      category: (product.groupName as string) || undefined,
      price: product.price ? Number(product.price) : undefined,
      currency: 'RUB',
    }))
  },
}
