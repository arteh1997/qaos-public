import type { PosProviderAdapter, PosMenuItem, PosOAuthTokens } from '../types'
import type { PosSaleEvent } from '@/lib/services/pos'
import { validateToastSignature } from '../webhook-validators'

const getClientId = () => process.env.TOAST_CLIENT_ID || ''
const getClientSecret = () => process.env.TOAST_CLIENT_SECRET || ''
const getRedirectUri = () => process.env.TOAST_REDIRECT_URI || ''

export const toastAdapter: PosProviderAdapter = {
  provider: 'toast',
  name: 'Toast',
  authType: 'oauth2',

  getAuthUrl(_storeId: string, stateToken: string): string {
    const params = new URLSearchParams({
      client_id: getClientId(),
      response_type: 'code',
      scope: 'orders.read menus.read',
      state: stateToken,
      redirect_uri: getRedirectUri(),
    })
    return `https://ws-api.toasttab.com/usermgmt/v1/oauth/authorize?${params}`
  },

  async exchangeCode(code: string): Promise<PosOAuthTokens> {
    const res = await fetch('https://ws-api.toasttab.com/authentication/v1/authentication/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: getClientId(),
        clientSecret: getClientSecret(),
        authorizationCode: code,
        grantType: 'authorization_code',
      }),
    })
    if (!res.ok) throw new Error(`Toast token exchange failed: ${res.status}`)
    const data = await res.json()
    return {
      access_token: data.accessToken || data.access_token,
      refresh_token: data.refreshToken || data.refresh_token,
      expires_at: data.expiresAt || new Date(Date.now() + 3600 * 1000).toISOString(),
    }
  },

  validateSignature(payload: string, signature: string, secret: string): boolean {
    return validateToastSignature(payload, signature, secret)
  },

  normalizeEvent(rawPayload: unknown): PosSaleEvent | null {
    const body = rawPayload as Record<string, unknown>
    if (!body.orderId) return null

    const items = (body.items as Record<string, unknown>[]) || []
    return {
      external_event_id: body.orderId as string,
      event_type: 'sale',
      items: items.map(item => ({
        pos_item_id: (item.guid as string) || (item.itemId as string) || '',
        pos_item_name: (item.name as string) || 'Unknown',
        quantity: Number(item.quantity) || 1,
        unit_price: item.price ? Number(item.price) : undefined,
      })),
      total_amount: body.amount ? Number(body.amount) : undefined,
      currency: 'USD',
      occurred_at: (body.createdDate as string) || new Date().toISOString(),
    }
  },

  async fetchMenuItems(credentials: Record<string, unknown>): Promise<PosMenuItem[]> {
    const res = await fetch('https://ws-api.toasttab.com/menus/v2/menus', {
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
        'Toast-Restaurant-External-ID': credentials.restaurant_guid as string || '',
      },
    })
    if (!res.ok) throw new Error(`Toast menu fetch failed: ${res.status}`)
    const data = await res.json()

    const items: PosMenuItem[] = []
    for (const menu of data || []) {
      for (const group of (menu as Record<string, unknown>).groups as Record<string, unknown>[] || []) {
        for (const item of (group as Record<string, unknown>).items as Record<string, unknown>[] || []) {
          items.push({
            pos_item_id: (item.guid as string) || '',
            pos_item_name: (item.name as string) || 'Unknown',
            category: (group as Record<string, unknown>).name as string || undefined,
            price: item.price ? Number(item.price) : undefined,
          })
        }
      }
    }
    return items
  },
}
