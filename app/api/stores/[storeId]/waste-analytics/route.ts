import { NextRequest } from 'next/server'
import { withApiAuth, canAccessStore } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiForbidden,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * GET /api/stores/:storeId/waste-analytics - Get waste analytics
 *
 * Returns:
 *   - totalWaste: Total waste quantity and estimated cost
 *   - byReason: Breakdown of waste by reason
 *   - topItems: Top wasted items
 *   - trend: Daily waste trend over the specified period
 *
 * Query params:
 *   - from (date filter start, ISO string, default: 30 days ago)
 *   - to (date filter end, ISO string, default: now)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth

    if (!canAccessStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const searchParams = request.nextUrl.searchParams
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const fromDate = searchParams.get('from') || thirtyDaysAgo.toISOString()
    const toDate = searchParams.get('to') || now.toISOString()

    // Fetch all waste logs for the period
    const { data: wasteLogs, error } = await context.supabase
      .from('waste_log')
      .select('*, inventory_item:inventory_items(id, name, category, unit_of_measure)')
      .eq('store_id', storeId)
      .gte('reported_at', fromDate)
      .lte('reported_at', toDate)
      .order('reported_at', { ascending: true })

    if (error) {
      return apiError('Failed to fetch waste analytics')
    }

    const logs = wasteLogs || []

    // Calculate total waste
    const totalQuantity = logs.reduce((sum: number, log: { quantity: number }) => sum + Number(log.quantity), 0)
    const totalCost = logs.reduce((sum: number, log: { estimated_cost: number }) => sum + Number(log.estimated_cost || 0), 0)
    const totalIncidents = logs.length

    // Breakdown by reason
    const reasonMap = new Map<string, { count: number; quantity: number; cost: number }>()
    for (const log of logs) {
      const existing = reasonMap.get(log.reason) || { count: 0, quantity: 0, cost: 0 }
      existing.count += 1
      existing.quantity += Number(log.quantity)
      existing.cost += Number(log.estimated_cost || 0)
      reasonMap.set(log.reason, existing)
    }

    const byReason = Array.from(reasonMap.entries())
      .map(([reason, stats]) => ({
        reason,
        count: stats.count,
        quantity: stats.quantity,
        estimated_cost: stats.cost,
        percentage: totalQuantity > 0 ? Math.round((stats.quantity / totalQuantity) * 100) : 0,
      }))
      .sort((a, b) => b.quantity - a.quantity)

    // Top wasted items
    const itemMap = new Map<string, {
      inventory_item_id: string
      item_name: string
      category: string | null
      unit_of_measure: string
      total_quantity: number
      total_cost: number
      incident_count: number
    }>()

    for (const log of logs) {
      const itemId = log.inventory_item_id
      const item = log.inventory_item as { id: string; name: string; category: string | null; unit_of_measure: string } | null
      const existing = itemMap.get(itemId) || {
        inventory_item_id: itemId,
        item_name: item?.name || 'Unknown',
        category: item?.category || null,
        unit_of_measure: item?.unit_of_measure || 'ea',
        total_quantity: 0,
        total_cost: 0,
        incident_count: 0,
      }
      existing.total_quantity += Number(log.quantity)
      existing.total_cost += Number(log.estimated_cost || 0)
      existing.incident_count += 1
      itemMap.set(itemId, existing)
    }

    const topItems = Array.from(itemMap.values())
      .sort((a, b) => b.total_quantity - a.total_quantity)
      .slice(0, 10)

    // Daily trend
    const dailyMap = new Map<string, { date: string; quantity: number; cost: number; incidents: number }>()
    for (const log of logs) {
      const date = new Date(log.reported_at).toISOString().split('T')[0]
      const existing = dailyMap.get(date) || { date, quantity: 0, cost: 0, incidents: 0 }
      existing.quantity += Number(log.quantity)
      existing.cost += Number(log.estimated_cost || 0)
      existing.incidents += 1
      dailyMap.set(date, existing)
    }

    const trend = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    return apiSuccess(
      {
        period: { from: fromDate, to: toDate },
        summary: {
          total_quantity: totalQuantity,
          total_estimated_cost: totalCost,
          total_incidents: totalIncidents,
        },
        by_reason: byReason,
        top_items: topItems,
        daily_trend: trend,
      },
      { requestId: context.requestId }
    )
  } catch (error) {
    logger.error('Error fetching waste analytics:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to fetch waste analytics')
  }
}
