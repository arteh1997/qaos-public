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

// Action categories for grouping
export type AuditCategory =
  | 'auth'      // Login, logout, password reset
  | 'user'      // User management (invite, role change, deactivate)
  | 'store'     // Store management (create, update, delete)
  | 'stock'     // Stock operations (count, reception, adjustment)
  | 'inventory' // Inventory item management
  | 'shift'     // Shift/schedule management
  | 'settings'  // Settings changes
  | 'report'    // Report generation/export

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
  | 'store.settings_update'
  // Stock
  | 'stock.count_submit'
  | 'stock.reception_submit'
  | 'stock.adjustment'
  // Inventory
  | 'inventory.item_create'
  | 'inventory.item_update'
  | 'inventory.item_delete'
  | 'inventory.bulk_import'
  // Shift
  | 'shift.create'
  | 'shift.update'
  | 'shift.delete'
  | 'shift.clock_in'
  | 'shift.clock_out'
  // Settings
  | 'settings.profile_update'
  | 'settings.notification_update'
  // Report
  | 'report.export'
  | 'report.generate'

export interface AuditLogEntry {
  userId?: string | null
  userEmail?: string | null
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

  // Check various headers for the real IP
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
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

/**
 * Log an audit event
 *
 * @param supabase - Supabase admin client (with service role)
 * @param entry - Audit log entry details
 */
export async function auditLog(
  supabase: SupabaseClient,
  entry: AuditLogEntry
): Promise<void> {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_id: entry.userId || null,
      user_email: entry.userEmail || null,
      action: entry.action,
      action_category: getCategoryFromAction(entry.action),
      store_id: entry.storeId || null,
      resource_type: entry.resourceType || null,
      resource_id: entry.resourceId || null,
      details: entry.details || {},
      ip_address: getIpAddress(entry.request),
      user_agent: getUserAgent(entry.request),
    })

    if (error) {
      // Log error but don't throw - audit logging should not break the main flow
      console.error('[Audit] Failed to write audit log:', error)
    }
  } catch (err) {
    // Catch any unexpected errors
    console.error('[Audit] Exception writing audit log:', err)
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
    const logs = entries.map((entry) => ({
      user_id: entry.userId || null,
      user_email: entry.userEmail || null,
      action: entry.action,
      action_category: getCategoryFromAction(entry.action),
      store_id: entry.storeId || null,
      resource_type: entry.resourceType || null,
      resource_id: entry.resourceId || null,
      details: entry.details || {},
      ip_address: getIpAddress(entry.request),
      user_agent: getUserAgent(entry.request),
    }))

    const { error } = await supabase.from('audit_logs').insert(logs)

    if (error) {
      console.error('[Audit] Failed to write batch audit logs:', error)
    }
  } catch (err) {
    console.error('[Audit] Exception writing batch audit logs:', err)
  }
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
