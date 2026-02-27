/**
 * Audit logging utility for tracking user actions
 *
 * Usage:
 * ```ts
 * await auditLog(adminClient, {
 *   userId: user.id,
 *   userEmail: user.email,
 *   action: 'user.invite',
 *   storeId: storeId,
 *   resourceType: 'user_invite',
 *   resourceId: invite.id,
 *   details: { email: invitedEmail, role: 'Staff' },
 *   request,
 * })
 * ```
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'

// Action categories for grouping
export type AuditCategory =
  | 'auth'      // Login, logout, password reset
  | 'user'      // User management (invite, role change, deactivate)
  | 'store'     // Store management (create, update, delete)
  | 'stock'     // Stock operations (count, reception, adjustment)
  | 'inventory' // Inventory item management
  | 'shift'     // Shift/schedule management
  | 'waste'     // Waste tracking and reporting
  | 'settings'  // Settings changes
  | 'report'    // Report generation/export
  | 'supplier'  // Supplier & purchase order management
  | 'payroll'   // Payroll & staff payments

// Pre-defined actions for type safety
export type AuditAction =
  // Auth
  | 'auth.login'
  | 'auth.logout'
  | 'auth.password_reset_request'
  | 'auth.password_reset_complete'
  // User
  | 'user.invite'
  | 'user.invite_cancel'
  | 'user.invite_resend'
  | 'user.onboard'
  | 'user.role_change'
  | 'user.deactivate'
  | 'user.reactivate'
  | 'user.remove_from_store'
  // Store
  | 'store.create'
  | 'store.update'
  | 'store.delete'
  | 'store.deactivate'
  | 'store.settings_update'
  // Stock
  | 'stock.count_submit'
  | 'stock.reception_submit'
  | 'stock.adjustment'
  | 'stock.waste_report'
  // Waste
  | 'waste.submit'
  // Inventory
  | 'inventory.item_create'
  | 'inventory.item_update'
  | 'inventory.item_delete'
  | 'inventory.bulk_import'
  | 'inventory.batch_update'
  | 'inventory.recipe_create'
  | 'inventory.recipe_update'
  | 'inventory.recipe_delete'
  | 'inventory.recipe_ingredient_add'
  | 'inventory.recipe_ingredient_remove'
  | 'inventory.menu_item_create'
  | 'inventory.menu_item_update'
  | 'inventory.menu_item_delete'
  // Shift
  | 'shift.create'
  | 'shift.update'
  | 'shift.delete'
  | 'shift.clock_in'
  | 'shift.clock_out'
  | 'shift.clock_time_correction'
  // Settings
  | 'settings.profile_update'
  | 'settings.notification_update'
  | 'settings.alert_preferences_update'
  | 'settings.update'
  | 'settings.pos_mapping_create'
  | 'settings.pos_mapping_delete'
  | 'settings.pos_connection_create'
  | 'settings.pos_connection_update'
  | 'settings.pos_connection_delete'
  // Report
  | 'report.export'
  | 'report.generate'
  // Supplier
  | 'supplier.create'
  | 'supplier.update'
  | 'supplier.delete'
  | 'supplier.item_add'
  | 'supplier.item_update'
  | 'supplier.item_remove'
  | 'supplier.po_create'
  | 'supplier.po_update'
  | 'supplier.po_receive'
  | 'supplier.po_cancel'
  // Payroll
  | 'payroll.rate_update'
  | 'payroll.pay_run_create'
  | 'payroll.pay_run_approve'
  | 'payroll.pay_run_paid'
  | 'payroll.pay_run_delete'
  | 'payroll.adjustment'

export interface AuditLogEntry {
  userId?: string | null
  userEmail?: string | null
  userName?: string | null
  action: AuditAction | string
  storeId?: string | null
  resourceType?: string
  resourceId?: string
  details?: Record<string, unknown>
  request?: NextRequest
}

/**
 * Extract category from action string
 */
function getCategoryFromAction(action: string): AuditCategory {
  const category = action.split('.')[0] as AuditCategory
  return category
}

/**
 * Extract IP address from request
 */
function getIpAddress(request?: NextRequest): string | null {
  if (!request) return null

  // Prefer x-real-ip (set by Vercel/trusted reverse proxy, cannot be spoofed)
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback to x-forwarded-for (first entry)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  // Fallback - may not be accurate behind proxies
  return request.headers.get('x-client-ip') || null
}

/**
 * Extract user agent from request
 */
function getUserAgent(request?: NextRequest): string | null {
  if (!request) return null
  return request.headers.get('user-agent')
}

/** Transform an audit log entry into the column format expected by the `audit_logs` table. */
function transformAuditLogEntry(entry: AuditLogEntry) {
  return {
    user_id: entry.userId || null,
    user_email: entry.userEmail || null,
    user_name: entry.userName || null,
    action: entry.action,
    action_category: getCategoryFromAction(entry.action),
    store_id: entry.storeId || null,
    resource_type: entry.resourceType || null,
    resource_id: entry.resourceId || null,
    details: entry.details || {},
    ip_address: getIpAddress(entry.request),
    user_agent: getUserAgent(entry.request),
  }
}

/**
 * Write a single audit log entry. Called fire-and-forget (without `await`) in most
 * API routes so that audit writes never block the response or cause user-facing errors.
 *
 * @param supabase - Supabase client (typically admin client to bypass RLS)
 * @param entry - Audit log entry with action, userId, storeId, and optional details
 */
export async function auditLog(
  supabase: SupabaseClient,
  entry: AuditLogEntry
): Promise<void> {
  try {
    const { error } = await supabase
      .from('audit_logs')
      .insert(transformAuditLogEntry(entry))

    if (error) {
      logger.error('[Audit] Failed to write audit log:', { error })
    }
  } catch (err) {
    logger.error('[Audit] Exception writing audit log:', { error: err })
  }
}

/**
 * Batch insert multiple audit log entries
 */
export async function auditLogBatch(
  supabase: SupabaseClient,
  entries: AuditLogEntry[]
): Promise<void> {
  if (entries.length === 0) return

  try {
    const logs = entries.map(transformAuditLogEntry)

    const { error } = await supabase.from('audit_logs').insert(logs)

    if (error) {
      logger.error('[Audit] Failed to write batch audit logs:', error)
    }
  } catch (err) {
    logger.error('[Audit] Exception writing batch audit logs:', err)
  }
}

/**
 * Deep equality check for audit comparison.
 * Handles primitives, arrays, and plain objects.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null || a === undefined || b === undefined) return a === b
  if (typeof a !== typeof b) return false

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, i) => deepEqual(item, b[i]))
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>
    const bObj = b as Record<string, unknown>
    const aKeys = Object.keys(aObj)
    const bKeys = Object.keys(bObj)
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every(key => key in bObj && deepEqual(aObj[key], bObj[key]))
  }

  return false
}

/**
 * Compute field-level changes between an old record and new update data.
 * Returns an array of { field, from, to } for fields that actually changed.
 * Used to enrich audit log details with before/after context.
 */
export function computeFieldChanges(
  oldRecord: Record<string, unknown>,
  newData: Record<string, unknown>
): Array<{ field: string; from: unknown; to: unknown }> {
  const changes: Array<{ field: string; from: unknown; to: unknown }> = []
  for (const [key, newValue] of Object.entries(newData)) {
    const oldValue = oldRecord[key]
    const normOld = normalizeForComparison(oldValue)
    const normNew = normalizeForComparison(newValue)
    if (!deepEqual(normOld, normNew)) {
      changes.push({ field: key, from: oldValue ?? null, to: newValue ?? null })
    }
  }
  return changes
}

/**
 * Normalize a value for comparison to avoid false positives
 * (e.g. "09:00" vs "09:00:00", "" vs null, "5" vs 5)
 */
function normalizeForComparison(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return null
  // Normalize time strings: "09:00" and "09:00:00" should match
  if (typeof value === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    return value.substring(0, 5) // Always compare as HH:MM
  }
  return value
}

/**
 * Helper to create a partial audit entry with common fields
 */
export function createAuditContext(
  request: NextRequest,
  userId?: string | null,
  userEmail?: string | null
): Pick<AuditLogEntry, 'request' | 'userId' | 'userEmail'> {
  return {
    request,
    userId,
    userEmail,
  }
}
