import type { PosProviderAdapter, PosMenuItem } from '../types'
import type { PosSaleEvent } from '@/lib/services/pos'
import { validateEposNowSignature } from '../webhook-validators'

/**
 * Epos Now Adapter
 *
 * Uses API key authentication (no OAuth flow).
 * API key is stored in the connection's credentials.
 */
export const eposNowAdapter: PosProviderAdapter = {
  provider: 'epos_now',
  name: 'Epos Now',
  authType: 'api_key',

  // No OAuth for API key providers
  getAuthUrl: undefined,
  exchangeCode: undefined,
  refreshToken: undefined,

  validateSignature(payload: string, signature: string, secret: string): boolean {
    return validateEposNowSignature(payload, signature, secret)
  },

  normalizeEvent(rawPayload: unknown): PosSaleEvent | null {
    const body = rawPayload as Record<string, unknown>
    const transactionId = body.TransactionId as string || body.Id as string
    if (!transactionId) return null

    const items = (body.TransactionItems as Record<string, unknown>[]) || []
    return {
      external_event_id: String(transactionId),
      event_type: body.IsRefund ? 'refund' : 'sale',
      items: items.map(item => ({
        pos_item_id: String(item.ProductId || item.Id || ''),
        pos_item_name: (item.ProductName as string) || (item.Name as string) || 'Unknown',
        quantity: Number(item.Quantity) || 1,
        unit_price: item.UnitPrice ? Number(item.UnitPrice) : undefined,
      })),
      total_amount: body.TotalAmount ? Number(body.TotalAmount) : undefined,
      currency: 'GBP',
      occurred_at: (body.DateTime as string) || new Date().toISOString(),
    }
  },

  async fetchMenuItems(credentials: Record<string, unknown>): Promise<PosMenuItem[]> {
    const apiKey = credentials.api_key as string
    const res = await fetch('https://api.eposnow.com/api/v4/Product', {
      headers: { Authorization: `Basic ${apiKey}` },
    })
    if (!res.ok) throw new Error(`Epos Now products fetch failed: ${res.status}`)
    const data = await res.json()

    return (data || []).map((product: Record<string, unknown>) => ({
      pos_item_id: String(product.Id),
      pos_item_name: (product.Name as string) || 'Unknown',
      category: (product.CategoryName as string) || undefined,
      price: product.SalePrice ? Number(product.SalePrice) : undefined,
      currency: 'GBP',
    }))
  },
}
