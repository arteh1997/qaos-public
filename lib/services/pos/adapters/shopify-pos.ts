import type { PosProviderAdapter, PosMenuItem, PosOAuthTokens } from '../types'
import type { PosSaleEvent } from '@/lib/services/pos'
import { validateShopifyPosSignature } from '../webhook-validators'

const getClientId = () => process.env.SHOPIFY_CLIENT_ID || ''
const getClientSecret = () => process.env.SHOPIFY_CLIENT_SECRET || ''
const getRedirectUri = () => process.env.SHOPIFY_REDIRECT_URI || ''

/**
 * Shopify POS Adapter
 *
 * Shopify's point-of-sale for retail and restaurant merchants.
 * OAuth2 authentication using Shopify's admin API.
 */
export const shopifyPosAdapter: PosProviderAdapter = {
  provider: 'shopify_pos',
  name: 'Shopify POS',
  authType: 'oauth2',

  getAuthUrl(_storeId: string, stateToken: string): string {
    const shopDomain = '' // Will be set during connection setup
    const params = new URLSearchParams({
      client_id: getClientId(),
      scope: 'read_products,read_orders',
      redirect_uri: getRedirectUri(),
      state: stateToken,
    })
    return `https://${shopDomain}.myshopify.com/admin/oauth/authorize?${params}`
  },

  async exchangeCode(code: string): Promise<PosOAuthTokens> {
    // Shopify requires the shop domain for token exchange
    // In practice, this would be passed via the state parameter or stored
    const res = await fetch('https://placeholder.myshopify.com/admin/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: getClientId(),
        client_secret: getClientSecret(),
        code,
      }),
    })
    if (!res.ok) throw new Error(`Shopify POS token exchange failed: ${res.status}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    }
  },

  async refreshToken(credentials: Record<string, unknown>): Promise<PosOAuthTokens> {
    const shopDomain = credentials.shop_domain as string || 'placeholder'
    const res = await fetch(`https://${shopDomain}.myshopify.com/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: getClientId(),
        client_secret: getClientSecret(),
        grant_type: 'refresh_token',
        refresh_token: credentials.refresh_token,
      }),
    })
    if (!res.ok) throw new Error(`Shopify POS token refresh failed: ${res.status}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    }
  },

  validateSignature(payload: string, signature: string, secret: string): boolean {
    return validateShopifyPosSignature(payload, signature, secret)
  },

  normalizeEvent(rawPayload: unknown): PosSaleEvent | null {
    const body = rawPayload as Record<string, unknown>
    const orderId = body.id as string || body.order_id as string
    if (!orderId) return null

    const items = (body.line_items as Record<string, unknown>[]) ||
                  (body.lineItems as Record<string, unknown>[]) || []
    return {
      external_event_id: String(orderId),
      event_type: body.financial_status === 'refunded' || body.type === 'refund' ? 'refund' : 'sale',
      items: items.map(item => ({
        pos_item_id: String(item.product_id || item.id || item.variant_id || ''),
        pos_item_name: (item.title as string) || (item.name as string) || 'Unknown',
        quantity: Number(item.quantity) || 1,
        unit_price: item.price ? Number(item.price) : undefined,
      })),
      total_amount: body.total_price ? Number(body.total_price) : undefined,
      currency: (body.currency as string) || 'USD',
      occurred_at: (body.created_at as string) || (body.createdAt as string) || new Date().toISOString(),
    }
  },

  async fetchMenuItems(credentials: Record<string, unknown>): Promise<PosMenuItem[]> {
    const shopDomain = credentials.shop_domain as string
    const accessToken = credentials.access_token as string
    const res = await fetch(`https://${shopDomain}.myshopify.com/admin/api/2024-01/products.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        Accept: 'application/json',
      },
    })
    if (!res.ok) throw new Error(`Shopify POS products fetch failed: ${res.status}`)
    const data = await res.json()

    return ((data.products as Record<string, unknown>[]) || []).map(product => ({
      pos_item_id: String(product.id),
      pos_item_name: (product.title as string) || 'Unknown',
      category: (product.product_type as string) || undefined,
      price: product.variants
        ? Number((product.variants as Record<string, unknown>[])[0]?.price) || undefined
        : undefined,
      currency: 'USD',
    }))
  },
}
