import type { PosProviderAdapter, PosMenuItem } from '../types'
import type { PosSaleEvent } from '@/lib/services/pos'
import { validateOracleMicrosSignature } from '../webhook-validators'

/**
 * Oracle MICROS (Simphony) Adapter
 *
 * Enterprise-grade POS used globally in hotels and large restaurant chains.
 * Uses API key authentication.
 * API docs: https://docs.oracle.com/en/industries/food-beverage/simphony/
 */
export const oracleMicrosAdapter: PosProviderAdapter = {
  provider: 'oracle_micros',
  name: 'Oracle MICROS',
  authType: 'api_key',

  getAuthUrl: undefined,
  exchangeCode: undefined,
  refreshToken: undefined,

  validateSignature(payload: string, signature: string, secret: string): boolean {
    return validateOracleMicrosSignature(payload, signature, secret)
  },

  normalizeEvent(rawPayload: unknown): PosSaleEvent | null {
    const body = rawPayload as Record<string, unknown>
    const checkId = body.checkId as string || body.transactionId as string
    if (!checkId) return null

    const detailLines = (body.detailLines as Record<string, unknown>[]) ||
                        (body.menuItems as Record<string, unknown>[]) || []
    return {
      external_event_id: String(checkId),
      event_type: body.isVoid ? 'void' : 'sale',
      items: detailLines.map(item => ({
        pos_item_id: String(item.menuItemId || item.objectNum || ''),
        pos_item_name: (item.menuItemName as string) || (item.name as string) || 'Unknown',
        quantity: Number(item.quantity) || 1,
        unit_price: item.price ? Number(item.price) / 100 : undefined,
      })),
      total_amount: body.totalDue ? Number(body.totalDue) / 100 : undefined,
      currency: (body.currencyCode as string) || 'USD',
      occurred_at: (body.closedTime as string) || (body.openTime as string) || new Date().toISOString(),
    }
  },

  async fetchMenuItems(credentials: Record<string, unknown>): Promise<PosMenuItem[]> {
    const baseUrl = (credentials.base_url as string) || 'https://api.micros.com'
    const res = await fetch(`${baseUrl}/v1/menu-items`, {
      headers: {
        Authorization: `Bearer ${credentials.api_key}`,
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) throw new Error(`Oracle MICROS menu fetch failed: ${res.status}`)
    const data = await res.json()

    return ((data.menuItems as Record<string, unknown>[]) || []).map(item => ({
      pos_item_id: String(item.objectNum || item.menuItemId),
      pos_item_name: (item.name as string) || 'Unknown',
      category: (item.familyGroupName as string) || undefined,
      price: item.price ? Number(item.price) / 100 : undefined,
      currency: 'USD',
    }))
  },
}
