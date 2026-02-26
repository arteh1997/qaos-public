import type { PosProviderAdapter, PosMenuItem, PosOAuthTokens } from '../types'
import type { PosSaleEvent } from '@/lib/services/pos'
import { validateSquareSignature } from '../webhook-validators'

const getClientId = () => process.env.SQUARE_APPLICATION_ID || ''
const getClientSecret = () => process.env.SQUARE_APPLICATION_SECRET || ''
const getRedirectUri = () => process.env.SQUARE_REDIRECT_URI || ''

export const squareAdapter: PosProviderAdapter = {
  provider: 'square',
  name: 'Square',
  authType: 'oauth2',

  getAuthUrl(_storeId: string, stateToken: string): string {
    const params = new URLSearchParams({
      client_id: getClientId(),
      response_type: 'code',
      scope: 'ITEMS_READ ORDERS_READ MERCHANT_PROFILE_READ',
      state: stateToken,
      session: 'false',
    })
    return `https://connect.squareup.com/oauth2/authorize?${params}`
  },

  async exchangeCode(code: string): Promise<PosOAuthTokens> {
    const res = await fetch('https://connect.squareup.com/oauth2/token', {
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
    if (!res.ok) throw new Error(`Square token exchange failed: ${res.status}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      merchant_id: data.merchant_id,
    }
  },

  async refreshToken(credentials: Record<string, unknown>): Promise<PosOAuthTokens> {
    const res = await fetch('https://connect.squareup.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: getClientId(),
        client_secret: getClientSecret(),
        refresh_token: credentials.refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    if (!res.ok) throw new Error(`Square token refresh failed: ${res.status}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    }
  },

  validateSignature(payload: string, signature: string, secret: string): boolean {
    return validateSquareSignature(payload, signature, secret)
  },

  normalizeEvent(rawPayload: unknown): PosSaleEvent | null {
    const body = rawPayload as Record<string, unknown>
    const data = body?.data as Record<string, unknown> | undefined
    const object = data?.object as Record<string, unknown> | undefined
    const order = object?.order_fulfillment_updated ?? object?.payment ?? object

    if (!order) return null

    const orderId = (order as Record<string, unknown>).order_id as string || crypto.randomUUID()
    const lineItems = ((order as Record<string, unknown>).line_items as Record<string, unknown>[]) || []

    return {
      external_event_id: orderId,
      event_type: 'sale',
      items: lineItems.map((li) => ({
        pos_item_id: (li.catalog_object_id as string) || (li.uid as string) || '',
        pos_item_name: (li.name as string) || 'Unknown',
        quantity: parseInt(li.quantity as string, 10) || 1,
        unit_price: li.base_price_money
          ? Number((li.base_price_money as Record<string, unknown>).amount) / 100
          : undefined,
      })),
      total_amount: body.total_money
        ? Number((body.total_money as Record<string, unknown>).amount) / 100
        : undefined,
      currency: 'GBP',
      occurred_at: (order as Record<string, unknown>).created_at as string || new Date().toISOString(),
    }
  },

  async fetchMenuItems(credentials: Record<string, unknown>): Promise<PosMenuItem[]> {
    const res = await fetch('https://connect.squareup.com/v2/catalog/list?types=ITEM', {
      headers: { Authorization: `Bearer ${credentials.access_token}` },
    })
    if (!res.ok) throw new Error(`Square catalog fetch failed: ${res.status}`)
    const data = await res.json()

    return (data.objects || []).map((obj: Record<string, unknown>) => {
      const itemData = obj.item_data as Record<string, unknown>
      const variation = ((itemData?.variations as Record<string, unknown>[]) || [])[0]
      const variationData = variation?.item_variation_data as Record<string, unknown> | undefined
      const priceMoney = variationData?.price_money as Record<string, unknown> | undefined

      return {
        pos_item_id: obj.id as string,
        pos_item_name: (itemData?.name as string) || 'Unknown',
        category: (itemData?.category as Record<string, unknown>)?.name as string || undefined,
        price: priceMoney ? Number(priceMoney.amount) / 100 : undefined,
        currency: priceMoney?.currency as string || 'GBP',
      }
    })
  },
}
