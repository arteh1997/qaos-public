import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * API Key Management Utilities
 *
 * Key format: rk_live_<32 random hex chars>
 * Storage: Only the SHA-256 hash is stored in the database
 * Lookup: The first 8 chars (prefix) are stored for display purposes
 */

const KEY_PREFIX = 'rk_live_'

/**
 * Generate a new API key
 * Returns the full key (only shown once) and its hash for storage
 */
export function generateApiKey(): { key: string; keyHash: string; keyPrefix: string } {
  const randomBytes = crypto.randomBytes(32).toString('hex')
  const key = `${KEY_PREFIX}${randomBytes}`
  const keyHash = hashApiKey(key)
  const keyPrefix = key.slice(0, KEY_PREFIX.length + 8) // e.g., "rk_live_a1b2c3d4"

  return { key, keyHash, keyPrefix }
}

/**
 * Hash an API key for storage/lookup
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

/**
 * Validate an API key and return the associated store/scopes
 */
export async function validateApiKey(key: string): Promise<{
  valid: boolean
  storeId?: string
  scopes?: string[]
  keyId?: string
} | null> {
  if (!key || !key.startsWith(KEY_PREFIX)) {
    return { valid: false }
  }

  const keyHash = hashApiKey(key)

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('api_keys')
    .select('id, store_id, scopes, is_active, expires_at')
    .eq('key_hash', keyHash)
    .single()

  if (error || !data) {
    return { valid: false }
  }

  if (!data.is_active) {
    return { valid: false }
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false }
  }

  // Update last_used_at (fire and forget)
  adminClient
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return {
    valid: true,
    storeId: data.store_id,
    scopes: data.scopes,
    keyId: data.id,
  }
}

/**
 * Check if a key has a specific scope
 */
export function hasScope(scopes: string[], required: string): boolean {
  // Wildcard scope
  if (scopes.includes('*')) return true

  // Exact match
  if (scopes.includes(required)) return true

  // Category wildcard (e.g., "inventory:*" matches "inventory:read")
  const [category] = required.split(':')
  if (scopes.includes(`${category}:*`)) return true

  return false
}

/**
 * Available API scopes
 */
export const API_SCOPES = {
  'inventory:read': 'Read inventory items and stock levels',
  'inventory:write': 'Create and update inventory items',
  'stock:read': 'Read stock history and counts',
  'stock:write': 'Submit stock counts and receptions',
  'reports:read': 'Access analytics and reports',
  'webhooks:manage': 'Manage webhook endpoints',
  '*': 'Full access to all API endpoints',
} as const

export type ApiScope = keyof typeof API_SCOPES

/**
 * Generate a webhook signing secret
 */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`
}

/**
 * Sign a webhook payload with HMAC-SHA256
 */
export function signWebhookPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}
