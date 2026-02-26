import type { PosProviderAdapter, PosMenuItem, PosOAuthTokens } from '../types'
import type { PosSaleEvent } from '@/lib/services/pos'
import { validateSumUpSignature } from '../webhook-validators'

const getClientId = () => process.env.SUMUP_CLIENT_ID || ''
const getClientSecret = () => process.env.SUMUP_CLIENT_SECRET || ''
const getRedirectUri = () => process.env.SUMUP_REDIRECT_URI || ''

export const sumupAdapter: PosProviderAdapter = {
  provider: 'sumup',
  name: 'SumUp',
  authType: 'oauth2',

  getAuthUrl(_storeId: string, stateToken: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: getClientId(),
      redirect_uri: getRedirectUri(),
      scope: 'payments products',
      state: stateToken,
    })
    return `https://api.sumup.com/authorize?${params}`
  },

  async exchangeCode(code: string): Promise<PosOAuthTokens> {
    const res = await fetch('https://api.sumup.com/token', {
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
    if (!res.ok) throw new Error(`SumUp token exchange failed: ${res.status}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    }
  },

  async refreshToken(credentials: Record<string, unknown>): Promise<PosOAuthTokens> {
    const res = await fetch('https://api.sumup.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: getClientId(),
        client_secret: getClientSecret(),
        refresh_token: credentials.refresh_token as string,
      }),
    })
    if (!res.ok) throw new Error(`SumUp token refresh failed: ${res.status}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    }
  },

  validateSignature(payload: string, signature: string, secret: string): boolean {
    return validateSumUpSignature(payload, signature, secret)
  },

  normalizeEvent(rawPayload: unknown): PosSaleEvent | null {
    const body = rawPayload as Record<string, unknown>
    const transactionId = body.transaction_id as string || body.id as string
    if (!transactionId) return null

    const products = (body.products as Record<string, unknown>[]) || []
    return {
      external_event_id: transactionId,
      event_type: body.status === 'REFUNDED' ? 'refund' : 'sale',
      items: products.map(p => ({
        pos_item_id: (p.product_id as string) || (p.name as string) || '',
        pos_item_name: (p.name as string) || 'Unknown',
        quantity: Number(p.quantity) || 1,
        unit_price: p.price ? Number(p.price) : undefined,
      })),
      total_amount: body.amount ? Number(body.amount) : undefined,
      currency: (body.currency as string) || 'GBP',
      occurred_at: (body.timestamp as string) || new Date().toISOString(),
    }
  },

  async fetchMenuItems(credentials: Record<string, unknown>): Promise<PosMenuItem[]> {
    const res = await fetch('https://api.sumup.com/v0.1/me/products', {
      headers: { Authorization: `Bearer ${credentials.access_token}` },
    })
    if (!res.ok) throw new Error(`SumUp products fetch failed: ${res.status}`)
    const data = await res.json()

    return (data || []).map((product: Record<string, unknown>) => ({
      pos_item_id: product.id as string,
      pos_item_name: (product.name as string) || 'Unknown',
      price: product.price ? Number(product.price) : undefined,
      currency: (product.currency as string) || 'GBP',
    }))
  },
}
