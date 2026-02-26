import type { PosProviderAdapter, PosMenuItem } from '../types'
import type { PosSaleEvent } from '@/lib/services/pos'
import { validateGastrofixSignature } from '../webhook-validators'

/**
 * Gastrofix Adapter
 *
 * iPad POS popular with German and European restaurants/hospitality.
 * Uses API key authentication.
 */
export const gastrofixAdapter: PosProviderAdapter = {
  provider: 'gastrofix',
  name: 'Gastrofix',
  authType: 'api_key',

  getAuthUrl: undefined,
  exchangeCode: undefined,
  refreshToken: undefined,

  validateSignature(payload: string, signature: string, secret: string): boolean {
    return validateGastrofixSignature(payload, signature, secret)
  },

  normalizeEvent(rawPayload: unknown): PosSaleEvent | null {
    const body = rawPayload as Record<string, unknown>
    const receiptId = body.receiptId as string || body.bon_id as string
    if (!receiptId) return null

    const positions = (body.positions as Record<string, unknown>[]) ||
                      (body.items as Record<string, unknown>[]) || []
    return {
      external_event_id: String(receiptId),
      event_type: body.storno ? 'void' : 'sale',
      items: positions.map(item => ({
        pos_item_id: String(item.articleId || item.artikel_id || ''),
        pos_item_name: (item.articleName as string) || (item.bezeichnung as string) || 'Unknown',
        quantity: Number(item.quantity || item.anzahl) || 1,
        unit_price: item.unitPrice ? Number(item.unitPrice) / 100 : (item.einzelpreis ? Number(item.einzelpreis) / 100 : undefined),
      })),
      total_amount: body.totalAmount ? Number(body.totalAmount) / 100 : (body.gesamtbetrag ? Number(body.gesamtbetrag) / 100 : undefined),
      currency: 'EUR',
      occurred_at: (body.closedAt as string) || (body.datum as string) || new Date().toISOString(),
    }
  },

  async fetchMenuItems(credentials: Record<string, unknown>): Promise<PosMenuItem[]> {
    const baseUrl = (credentials.base_url as string) || 'https://api.gastrofix.com'
    const res = await fetch(`${baseUrl}/v1/articles`, {
      headers: {
        'X-Api-Key': credentials.api_key as string,
        Accept: 'application/json',
      },
    })
    if (!res.ok) throw new Error(`Gastrofix articles fetch failed: ${res.status}`)
    const data = await res.json()

    return ((data.articles as Record<string, unknown>[]) || []).map(item => ({
      pos_item_id: String(item.id || item.artikelId),
      pos_item_name: (item.name as string) || (item.bezeichnung as string) || 'Unknown',
      category: (item.categoryName as string) || (item.warengruppe as string) || undefined,
      price: item.price ? Number(item.price) / 100 : undefined,
      currency: 'EUR',
    }))
  },
}
