import type { PosProviderAdapter, PosMenuItem, PosOAuthTokens } from '../types'
import type { PosSaleEvent } from '@/lib/services/pos'
import { validateFoodicsSignature } from '../webhook-validators'

const getClientId = () => process.env.FOODICS_CLIENT_ID || ''
const getClientSecret = () => process.env.FOODICS_CLIENT_SECRET || ''
const getRedirectUri = () => process.env.FOODICS_REDIRECT_URI || ''

/**
 * Foodics Adapter
 *
 * Leading POS in Saudi Arabia and the Gulf region.
 * OAuth2 authentication via Foodics Console.
 * API docs: https://console.foodics.com/docs
 */
export const foodicsAdapter: PosProviderAdapter = {
  provider: 'foodics',
  name: 'Foodics',
  authType: 'oauth2',

  getAuthUrl(_storeId: string, stateToken: string): string {
    const params = new URLSearchParams({
      client_id: getClientId(),
      response_type: 'code',
      redirect_uri: getRedirectUri(),
      state: stateToken,
    })
    return `https://console.foodics.com/authorize?${params}`
  },

  async exchangeCode(code: string): Promise<PosOAuthTokens> {
    const res = await fetch('https://api-sandbox.foodics.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: getClientId(),
        client_secret: getClientSecret(),
        code,
        redirect_uri: getRedirectUri(),
      }),
    })
    if (!res.ok) throw new Error(`Foodics token exchange failed: ${res.status}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in || 86400) * 1000).toISOString(),
    }
  },

  async refreshToken(credentials: Record<string, unknown>): Promise<PosOAuthTokens> {
    const res = await fetch('https://api-sandbox.foodics.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: getClientId(),
        client_secret: getClientSecret(),
        refresh_token: credentials.refresh_token,
      }),
    })
    if (!res.ok) throw new Error(`Foodics token refresh failed: ${res.status}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in || 86400) * 1000).toISOString(),
    }
  },

  validateSignature(payload: string, signature: string, secret: string): boolean {
    return validateFoodicsSignature(payload, signature, secret)
  },

  normalizeEvent(rawPayload: unknown): PosSaleEvent | null {
    const body = rawPayload as Record<string, unknown>
    const order = body.order as Record<string, unknown> | undefined
    if (!order) return null

    const orderId = (order.reference as string) || (order.id as string)
    if (!orderId) return null

    const products = (order.products as Record<string, unknown>[]) || []
    return {
      external_event_id: orderId,
      event_type: 'sale',
      items: products.map(p => ({
        pos_item_id: (p.product_id as string) || (p.id as string) || '',
        pos_item_name: (p.name as string) || (p.display_name as string) || 'Unknown',
        quantity: Number(p.quantity) || 1,
        unit_price: p.price ? Number(p.price) : undefined,
      })),
      total_amount: order.total_price ? Number(order.total_price) : undefined,
      currency: (order.currency as string) || 'SAR',
      occurred_at: (order.created_at as string) || new Date().toISOString(),
    }
  },

  async fetchMenuItems(credentials: Record<string, unknown>): Promise<PosMenuItem[]> {
    const res = await fetch('https://api-sandbox.foodics.com/v5/products?include=category', {
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) throw new Error(`Foodics products fetch failed: ${res.status}`)
    const data = await res.json()

    return ((data.data as Record<string, unknown>[]) || []).map(product => ({
      pos_item_id: product.id as string,
      pos_item_name: (product.name as string) || 'Unknown',
      category: (product.category as Record<string, unknown>)?.name as string || undefined,
      price: product.price ? Number(product.price) : undefined,
      currency: 'SAR',
    }))
  },
}
