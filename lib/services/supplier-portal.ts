/**
 * Supplier Portal Service
 *
 * Token generation (sp_live_<hex>), activity logging,
 * and portal-side data access helpers.
 */

import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupplierPortalPermission } from '@/types'

const TOKEN_PREFIX = 'sp_live_'

// ── Token Management ──

/**
 * Generate a new supplier portal token.
 * Returns the full plaintext token (shown once) plus its hash and display prefix.
 */
export function generatePortalToken(): {
  token: string
  tokenHash: string
  tokenPrefix: string
} {
  const randomBytes = crypto.randomBytes(32).toString('hex')
  const token = `${TOKEN_PREFIX}${randomBytes}`
  const tokenHash = hashPortalToken(token)
  const tokenPrefix = token.slice(0, TOKEN_PREFIX.length + 8) // "sp_live_a1b2c3d4"
  return { token, tokenHash, tokenPrefix }
}

/**
 * SHA-256 hash a portal token for storage / lookup.
 */
export function hashPortalToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Validate a supplier portal token.
 * Returns supplier/store context + permissions, or null if invalid.
 */
export async function validatePortalToken(token: string): Promise<{
  valid: boolean
  tokenId?: string
  supplierId?: string
  storeId?: string
  supplierName?: string
  permissions?: Record<SupplierPortalPermission, boolean>
} | null> {
  if (!token || !token.startsWith(TOKEN_PREFIX)) {
    return { valid: false }
  }

  const tokenHash = hashPortalToken(token)
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('supplier_portal_tokens')
    .select('id, supplier_id, store_id, is_active, expires_at, can_view_orders, can_upload_invoices, can_update_catalog, can_update_order_status')
    .eq('token_hash', tokenHash)
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

  // Get supplier name for portal display
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('name')
    .eq('id', data.supplier_id)
    .single()

  // Update last_used_at (fire and forget)
  supabase
    .from('supplier_portal_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return {
    valid: true,
    tokenId: data.id,
    supplierId: data.supplier_id,
    storeId: data.store_id,
    supplierName: supplier?.name || 'Supplier',
    permissions: {
      can_view_orders: data.can_view_orders,
      can_upload_invoices: data.can_upload_invoices,
      can_update_catalog: data.can_update_catalog,
      can_update_order_status: data.can_update_order_status,
    },
  }
}

// ── Activity Logging ──

export async function logPortalActivity(params: {
  supplierId: string
  storeId: string
  tokenId?: string
  action: string
  details?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<void> {
  const supabase = createAdminClient()

  await supabase.from('supplier_portal_activity').insert({
    supplier_id: params.supplierId,
    store_id: params.storeId,
    token_id: params.tokenId || null,
    action: params.action,
    details: JSON.parse(JSON.stringify(params.details || {})),
    ip_address: params.ipAddress || null,
    user_agent: params.userAgent || null,
  })
}
