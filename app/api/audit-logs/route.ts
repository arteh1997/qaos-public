import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { RATE_LIMITS } from '@/lib/rate-limit'
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

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (context.supabase as any)
      .from('audit_logs')
      .select(`
        *,
        user:profiles!audit_logs_user_id_fkey(id, full_name, email),
        store:stores!audit_logs_store_id_fkey(id, name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (storeId) {
      query = query.eq('store_id', storeId)
    }

    if (category) {
      query = query.eq('action_category', category)
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
      console.error('[AuditLogs] Query error:', error)
      throw error
    }

    return apiSuccess(
      {
        logs: logs || [],
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
    console.error('[AuditLogs] Error:', error)
    return apiError(
      error instanceof Error ? error.message : 'Failed to fetch audit logs'
    )
  }
}
