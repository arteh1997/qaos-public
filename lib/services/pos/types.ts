/**
 * POS Provider Adapter Interface
 *
 * Each POS provider implements this interface for OAuth, webhook verification,
 * event normalization, and menu item syncing.
 */

import type { PosSaleEvent } from '@/lib/services/pos'

export interface PosMenuItem {
  pos_item_id: string
  pos_item_name: string
  category?: string
  price?: number
  currency?: string
}

export interface PosOAuthTokens {
  access_token: string
  refresh_token?: string
  expires_at?: string
  merchant_id?: string
  location_id?: string
}

export interface PosProviderAdapter {
  provider: string
  name: string
  authType: 'oauth2' | 'api_key'

  // OAuth (for oauth2 type)
  getAuthUrl?(storeId: string, stateToken: string): string
  exchangeCode?(code: string): Promise<PosOAuthTokens>
  refreshToken?(credentials: Record<string, unknown>): Promise<PosOAuthTokens>

  // Webhook verification
  validateSignature(payload: string, signature: string, secret: string): boolean

  // Event normalization — convert provider-specific webhook to standard PosSaleEvent
  normalizeEvent(rawPayload: unknown): PosSaleEvent | null

  // Menu item sync — pull items from POS API
  fetchMenuItems?(credentials: Record<string, unknown>): Promise<PosMenuItem[]>
}

/**
 * Provider metadata for UI display
 */
export interface PosProviderInfo {
  name: string
  description: string
  authType: 'oauth2' | 'api_key'
  logo?: string
  region: string
}
