import type { PosProviderAdapter, PosMenuItem, PosOAuthTokens } from '../types'
import type { PosSaleEvent } from '@/lib/services/pos'
import { validateZettleSignature } from '../webhook-validators'

const getClientId = () => process.env.ZETTLE_CLIENT_ID || ''
const getClientSecret = () => process.env.ZETTLE_CLIENT_SECRET || ''
const getRedirectUri = () => process.env.ZETTLE_REDIRECT_URI || ''

export const zettleAdapter: PosProviderAdapter = {
  provider: 'zettle',
  name: 'Zettle by PayPal',
  authType: 'oauth2',

  getAuthUrl(_storeId: string, stateToken: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: getClientId(),
      scope: 'READ:PRODUCT READ:PURCHASE',
      redirect_uri: getRedirectUri(),
      state: stateToken,
    })
    return `https://oauth.zettle.com/authorize?${params}`
  },

  async exchangeCode(code: string): Promise<PosOAuthTokens> {
    const res = await fetch('https://oauth.zettle.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: getClientId(),
        client_secret: getClientSecret(),
        code,
        redirect_uri: getRedirectUri(),
      }),
    })
    if (!res.ok) throw new Error(`Zettle token exchange failed: ${res.status}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in || 7200) * 1000).toISOString(),
    }
  },

  async refreshToken(credentials: Record<string, unknown>): Promise<PosOAuthTokens> {
    const res = await fetch('https://oauth.zettle.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: getClientId(),
        client_secret: getClientSecret(),
        refresh_token: credentials.refresh_token as string,
      }),
    })
    if (!res.ok) throw new Error(`Zettle token refresh failed: ${res.status}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in || 7200) * 1000).toISOString(),
    }
  },

  validateSignature(payload: string, signature: string, secret: string): boolean {
    return validateZettleSignature(payload, signature, secret)
  },

  normalizeEvent(rawPayload: unknown): PosSaleEvent | null {
    const body = rawPayload as Record<string, unknown>
    const purchaseUUID = body.purchaseUUID as string || body.uuid as string
    if (!purchaseUUID) return null

    const products = (body.products as Record<string, unknown>[]) || []
    return {
      external_event_id: purchaseUUID,
      event_type: 'sale',
      items: products.map(p => ({
        pos_item_id: (p.uuid as string) || (p.productUuid as string) || '',
        pos_item_name: (p.name as string) || 'Unknown',
        quantity: Number(p.quantity) || 1,
        unit_price: p.unitPrice ? Number(p.unitPrice) / 100 : undefined,
      })),
      total_amount: body.amount ? Number(body.amount) / 100 : undefined,
      currency: 'GBP',
      occurred_at: (body.timestamp as string) || new Date().toISOString(),
    }
  },

  async fetchMenuItems(credentials: Record<string, unknown>): Promise<PosMenuItem[]> {
    const res = await fetch('https://products.izettle.com/organizations/self/products/v2', {
      headers: { Authorization: `Bearer ${credentials.access_token}` },
    })
    if (!res.ok) throw new Error(`Zettle products fetch failed: ${res.status}`)
    const data = await res.json()

    return (data || []).map((product: Record<string, unknown>) => {
      const variant = ((product.variants as Record<string, unknown>[]) || [])[0]
      return {
        pos_item_id: product.uuid as string,
        pos_item_name: (product.name as string) || 'Unknown',
        category: (product.category as Record<string, unknown>)?.name as string || undefined,
        price: variant?.price ? Number((variant.price as Record<string, unknown>).amount) / 100 : undefined,
        currency: 'GBP',
      }
    })
  },
}
