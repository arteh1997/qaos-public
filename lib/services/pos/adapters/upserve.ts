import type { PosProviderAdapter, PosMenuItem, PosOAuthTokens } from '../types'
import type { PosSaleEvent } from '@/lib/services/pos'
import { validateUpserveSignature } from '../webhook-validators'

const getClientId = () => process.env.UPSERVE_CLIENT_ID || ''
const getClientSecret = () => process.env.UPSERVE_CLIENT_SECRET || ''
const getRedirectUri = () => process.env.UPSERVE_REDIRECT_URI || ''

/**
 * Upserve Adapter
 *
 * Lightspeed Restaurant (formerly Upserve) POS for full-service restaurants.
 * OAuth2 authentication.
 */
export const upserveAdapter: PosProviderAdapter = {
  provider: 'upserve',
  name: 'Upserve',
  authType: 'oauth2',

  getAuthUrl(_storeId: string, stateToken: string): string {
    const params = new URLSearchParams({
      client_id: getClientId(),
      response_type: 'code',
      redirect_uri: getRedirectUri(),
      state: stateToken,
      scope: 'orders:read items:read',
    })
    return `https://api.upserve.com/oauth/authorize?${params}`
  },

  async exchangeCode(code: string): Promise<PosOAuthTokens> {
    const res = await fetch('https://api.upserve.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: getClientId(),
        client_secret: getClientSecret(),
        code,
        redirect_uri: getRedirectUri(),
      }),
    })
    if (!res.ok) throw new Error(`Upserve token exchange failed: ${res.status}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    }
  },

  async refreshToken(credentials: Record<string, unknown>): Promise<PosOAuthTokens> {
    const res = await fetch('https://api.upserve.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: getClientId(),
        client_secret: getClientSecret(),
        refresh_token: credentials.refresh_token,
      }),
    })
    if (!res.ok) throw new Error(`Upserve token refresh failed: ${res.status}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    }
  },

  validateSignature(payload: string, signature: string, secret: string): boolean {
    return validateUpserveSignature(payload, signature, secret)
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
    const res = await fetch('https://api.upserve.com/v1/menu/items', {
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) throw new Error(`Upserve menu fetch failed: ${res.status}`)
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
