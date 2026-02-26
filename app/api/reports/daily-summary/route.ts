import { NextRequest } from 'next/server'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { withApiAuth } from '@/lib/api/middleware'
import { apiSuccess, apiError } from '@/lib/api/response'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager', 'Staff'],
      rateLimit: { key: 'reports', config: RATE_LIMITS.reports },
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // Get params
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]
    const storeId = searchParams.get('store_id')

    // Build query
    const startOfDay = `${date}T00:00:00.000Z`
    const endOfDay = `${date}T23:59:59.999Z`

    let query = context.supabase
      .from('stock_history')
      .select(`
        id, created_at, action_type, quantity_before, quantity_after, quantity_change, notes, store_id,
        inventory_item:inventory_items(id, name, category, unit_of_measure),
        store:stores(id, name),
        performer:profiles(id, full_name, email)
      `)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .order('created_at', { ascending: false })

    if (storeId) {
      query = query.eq('store_id', storeId)
    }

    const { data: history, error } = await query

    if (error) throw error

    // Get daily counts for the date
    const { data: dailyCounts } = await context.supabase
      .from('daily_counts')
      .select(`
        id, count_date, item_count, store_id, submitted_at,
        store:stores(id, name),
        submitter:profiles(id, full_name)
      `)
      .eq('count_date', date)

    // Summary - cast to avoid type issues
    const historyData = history as Array<{ action_type: string }> | null
    const counts = (historyData ?? []).filter(h => h.action_type === 'Count')
    const receptions = (historyData ?? []).filter(h => h.action_type === 'Reception')

    return apiSuccess(
      {
        date,
        summary: {
          total_counts: counts.length,
          total_receptions: receptions.length,
          stores_counted: dailyCounts?.length ?? 0,
        },
        daily_counts: dailyCounts ?? [],
        stock_changes: history ?? [],
      },
      { requestId: context.requestId }
    )
  } catch (error) {
    logger.error('Error fetching daily summary:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to fetch report')
  }
}
