import type { PosProviderAdapter, PosMenuItem } from '../types'
import type { PosSaleEvent } from '@/lib/services/pos'
import { validateTevalisSignature } from '../webhook-validators'

/**
 * Tevalis Adapter
 *
 * Uses API key + secret authentication (no OAuth flow).
 * Credentials stored in the connection's credentials field.
 */
export const tevalisAdapter: PosProviderAdapter = {
  provider: 'tevalis',
  name: 'Tevalis',
  authType: 'api_key',

  getAuthUrl: undefined,
  exchangeCode: undefined,
  refreshToken: undefined,

  validateSignature(payload: string, signature: string, secret: string): boolean {
    return validateTevalisSignature(payload, signature, secret)
  },

  normalizeEvent(rawPayload: unknown): PosSaleEvent | null {
    const body = rawPayload as Record<string, unknown>
    const saleId = body.sale_id as string || body.id as string
    if (!saleId) return null

    const items = (body.items as Record<string, unknown>[]) || []
    return {
      external_event_id: String(saleId),
      event_type: body.type === 'refund' ? 'refund' : 'sale',
      items: items.map(item => ({
        pos_item_id: String(item.product_id || item.id || ''),
        pos_item_name: (item.product_name as string) || (item.name as string) || 'Unknown',
        quantity: Number(item.quantity) || 1,
        unit_price: item.unit_price ? Number(item.unit_price) : undefined,
      })),
      total_amount: body.total ? Number(body.total) : undefined,
      currency: 'GBP',
      occurred_at: (body.created_at as string) || new Date().toISOString(),
    }
  },

  async fetchMenuItems(credentials: Record<string, unknown>): Promise<PosMenuItem[]> {
    const apiKey = credentials.api_key as string
    const apiSecret = credentials.api_secret as string
    const res = await fetch('https://api.tevalis.com/v1/products', {
      headers: {
        'X-Api-Key': apiKey,
        'X-Api-Secret': apiSecret,
      },
    })
    if (!res.ok) throw new Error(`Tevalis products fetch failed: ${res.status}`)
    const data = await res.json()

    return (data.products || data || []).map((product: Record<string, unknown>) => ({
      pos_item_id: String(product.id),
      pos_item_name: (product.name as string) || 'Unknown',
      category: (product.category_name as string) || undefined,
      price: product.price ? Number(product.price) : undefined,
      currency: 'GBP',
    }))
  },
}
