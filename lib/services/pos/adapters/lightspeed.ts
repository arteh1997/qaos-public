import type { PosProviderAdapter, PosMenuItem, PosOAuthTokens } from '../types'
import type { PosSaleEvent } from '@/lib/services/pos'
import { validateLightspeedSignature } from '../webhook-validators'

const getClientId = () => process.env.LIGHTSPEED_CLIENT_ID || ''
const getClientSecret = () => process.env.LIGHTSPEED_CLIENT_SECRET || ''
const getRedirectUri = () => process.env.LIGHTSPEED_REDIRECT_URI || ''

export const lightspeedAdapter: PosProviderAdapter = {
  provider: 'lightspeed',
  name: 'Lightspeed',
  authType: 'oauth2',

  getAuthUrl(_storeId: string, stateToken: string): string {
    const params = new URLSearchParams({
      client_id: getClientId(),
      response_type: 'code',
      scope: 'employee:sales employee:inventory',
      state: stateToken,
      redirect_uri: getRedirectUri(),
    })
    return `https://cloud.lightspeedapp.com/oauth/authorize.php?${params}`
  },

  async exchangeCode(code: string): Promise<PosOAuthTokens> {
    const res = await fetch('https://cloud.lightspeedapp.com/oauth/access_token.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: getClientId(),
        client_secret: getClientSecret(),
        code,
        grant_type: 'authorization_code',
        redirect_uri: getRedirectUri(),
      }),
    })
    if (!res.ok) throw new Error(`Lightspeed token exchange failed: ${res.status}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    }
  },

  async refreshToken(credentials: Record<string, unknown>): Promise<PosOAuthTokens> {
    const res = await fetch('https://cloud.lightspeedapp.com/oauth/access_token.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: getClientId(),
        client_secret: getClientSecret(),
        refresh_token: credentials.refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    if (!res.ok) throw new Error(`Lightspeed token refresh failed: ${res.status}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    }
  },

  validateSignature(payload: string, signature: string, secret: string): boolean {
    return validateLightspeedSignature(payload, signature, secret)
  },

  normalizeEvent(rawPayload: unknown): PosSaleEvent | null {
    const body = rawPayload as Record<string, unknown>
    const sale = body.Sale as Record<string, unknown> | undefined
    if (!sale) return null

    const saleLines = (sale.SaleLines as Record<string, unknown>[]) || []
    return {
      external_event_id: (sale.saleID as string) || '',
      event_type: sale.completed === 'false' ? 'void' : 'sale',
      items: saleLines.map(line => ({
        pos_item_id: (line.itemID as string) || '',
        pos_item_name: (line.Item as Record<string, unknown>)?.description as string || 'Unknown',
        quantity: Number(line.unitQuantity) || 1,
        unit_price: line.unitPrice ? Number(line.unitPrice) : undefined,
      })),
      total_amount: sale.total ? Number(sale.total) : undefined,
      currency: 'GBP',
      occurred_at: (sale.timeStamp as string) || new Date().toISOString(),
    }
  },

  async fetchMenuItems(credentials: Record<string, unknown>): Promise<PosMenuItem[]> {
    const accountId = credentials.account_id as string
    const res = await fetch(
      `https://api.lightspeedapp.com/API/V3/Account/${accountId}/Item.json`,
      { headers: { Authorization: `Bearer ${credentials.access_token}` } }
    )
    if (!res.ok) throw new Error(`Lightspeed items fetch failed: ${res.status}`)
    const data = await res.json()

    return (data.Item || []).map((item: Record<string, unknown>) => {
      const prices = item.Prices as Record<string, unknown> | undefined
      const itemPrices = prices?.ItemPrice as Record<string, unknown>[] | undefined
      const firstPrice = itemPrices?.[0]
      return {
        pos_item_id: item.itemID as string,
        pos_item_name: (item.description as string) || 'Unknown',
        category: (item.Category as Record<string, unknown>)?.name as string || undefined,
        price: firstPrice?.amount ? Number(firstPrice.amount) : undefined,
        currency: 'GBP',
      }
    })
  },
}
