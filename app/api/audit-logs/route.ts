import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { createAdminClient } from '@/lib/supabase/admin'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
} from '@/lib/api/response'

/**
 * GET /api/audit-logs - Retrieve audit logs
 *
 * Query parameters:
 * - storeId: Filter by store (required for Managers)
 * - category: Filter by action category (auth, user, stock, etc.)
 * - action: Filter by specific action (e.g., "user.invite")
 * - userId: Filter by user who performed the action
 * - startDate: Filter from this date (ISO string)
 * - endDate: Filter until this date (ISO string)
 * - limit: Number of records to return (default: 50, max: 100)
 * - offset: Number of records to skip (for pagination)
 */
export async function GET(request: NextRequest) {
  try {
    // Only Owners and Managers can view audit logs
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const storeId = searchParams.get('storeId')
    const category = searchParams.get('category')
    const action = searchParams.get('action')
    const userId = searchParams.get('userId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Managers must specify a store they have access to
    const userRole = context.stores?.find(s =>
      storeId ? s.store_id === storeId : true
    )?.role

    if (userRole === 'Manager' && !storeId) {
      return apiBadRequest(
        'Store ID is required for managers',
        context.requestId
      )
    }

    // Get accessible store IDs for the user (for non-admin users)
    const accessibleStoreIds = context.stores.map(s => s.store_id)

    // Use admin client to bypass RLS (auth already verified above)
    const adminClient = createAdminClient()

    // Build query
    let query = adminClient
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters — scope to user's stores unless platform admin
    if (storeId) {
      query = query.eq('store_id', storeId)
    } else if (!context.profile.is_platform_admin && accessibleStoreIds.length > 0) {
      // Show logs for all user's stores + their own personal logs
      query = query.or(`store_id.in.(${accessibleStoreIds.join(',')}),user_id.eq.${context.user.id}`)
    }

    if (category) {
      const categories = category.split(',').map(c => c.trim()).filter(Boolean)
      if (categories.length === 1) {
        query = query.eq('action_category', categories[0])
      } else if (categories.length > 1) {
        query = query.in('action_category', categories)
      }
    }

    if (action) {
      query = query.eq('action', action)
    }

    if (userId) {
      query = query.eq('user_id', userId)
    }

    if (startDate) {
      query = query.gte('created_at', startDate)
    }

    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data: logs, error, count } = await query

    if (error) {
      logger.error('[AuditLogs] Query error:', { error: error })
      throw error
    }

    // Resolve missing user_name from profiles for older entries
    // user_name column added in migration 047, may not be in generated types yet
    interface AuditLogRow {
      id: string
      user_id: string
      store_id: string | null
      action: string
      action_category: string | null
      details: Record<string, unknown> | null
      user_name?: string | null
      created_at: string
      [key: string]: unknown
    }
    const logsWithNames: AuditLogRow[] = (logs || []) as AuditLogRow[]

    const missingNameUserIds = [
      ...new Set(
        logsWithNames
          .filter(log => !log.user_name && log.user_id)
          .map(log => log.user_id as string)
      ),
    ]

    if (missingNameUserIds.length > 0) {
      const { data: profiles } = await adminClient
        .from('profiles')
        .select('id, full_name')
        .in('id', missingNameUserIds)

      if (profiles && profiles.length > 0) {
        const profileMap = new Map(
          profiles.map((p: { id: string; full_name: string | null }) => [p.id, p.full_name])
        )
        for (const log of logsWithNames) {
          if (!log.user_name && log.user_id && profileMap.has(log.user_id)) {
            log.user_name = profileMap.get(log.user_id) || null
          }
        }
      }
    }

    // Resolve missing itemName in details for inventory/stock entries
    const missingItemNameLogs = logsWithNames.filter(
      log =>
        log.resource_type === 'inventory_item' &&
        log.resource_id &&
        log.details &&
        typeof log.details === 'object' &&
        !(log.details as Record<string, unknown>).itemName &&
        !(log.details as Record<string, unknown>).item_name
    )

    if (missingItemNameLogs.length > 0) {
      const itemIds = [...new Set(missingItemNameLogs.map(log => log.resource_id as string))]
      const { data: items } = await adminClient
        .from('inventory_items')
        .select('id, name')
        .in('id', itemIds)

      if (items && items.length > 0) {
        const itemMap = new Map(items.map((i: { id: string; name: string }) => [i.id, i.name]))
        for (const log of missingItemNameLogs) {
          const name = itemMap.get(log.resource_id as string)
          if (name && typeof log.details === 'object') {
            ;(log.details as Record<string, unknown>).itemName = name
          }
        }
      }
    }

    return apiSuccess(
      {
        logs: logsWithNames,
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (count || 0) > offset + limit,
        },
      },
      { requestId: context.requestId }
    )
  } catch (error) {
    logger.error('[AuditLogs] Error:', { error: error })
    return apiError(
      error instanceof Error ? error.message : 'Failed to fetch audit logs'
    )
  }
}
