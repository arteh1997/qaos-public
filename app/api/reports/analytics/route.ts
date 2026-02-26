import { NextRequest } from 'next/server'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { withApiAuth, canAccessStore } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest, apiForbidden } from '@/lib/api/response'
import { logger } from '@/lib/logger'

/**
 * GET /api/reports/analytics - Comprehensive analytics data for dashboard charts
 *
 * Query params:
 *   - store_id (required): Store to get analytics for
 *   - days (optional): Number of days to look back (default: 30, max: 90)
 *
 * Returns:
 *   - stockActivityByDay: Daily counts/receptions over time
 *   - topMovingItems: Items with most stock changes
 *   - categoryBreakdown: Inventory distribution by category
 *   - inventoryHealth: Current health metrics
 *   - countCompletionRate: % of days with stock counts completed
 *   - stockValueTrend: Daily total quantity trend
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'reports', config: RATE_LIMITS.reports },
    })

    if (!auth.success) return auth.response

    const { context } = auth
    const searchParams = request.nextUrl.searchParams
    const storeId = searchParams.get('store_id')
    const days = Math.min(parseInt(searchParams.get('days') ?? '30', 10) || 30, 90)

    if (!storeId) {
      return apiBadRequest('store_id is required', context.requestId)
    }

    if (!canAccessStore(context, storeId)) {
      return apiForbidden('Access denied to this store', context.requestId)
    }

    const now = new Date()
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString()

    // Run all queries in parallel
    const [
      stockHistoryResult,
      inventoryResult,
      dailyCountsResult,
      categoryResult,
    ] = await Promise.all([
      // 1. Stock history for the period
      context.supabase
        .from('stock_history')
        .select('id,action_type,quantity_before,quantity_after,quantity_change,inventory_item_id,created_at,inventory_item:inventory_items(name,category)')
        .eq('store_id', storeId)
        .gte('created_at', startDateStr)
        .order('created_at', { ascending: true }),

      // 2. Current inventory state
      context.supabase
        .from('store_inventory')
        .select('inventory_item_id,quantity,par_level,inventory_item:inventory_items(name,category,is_active)')
        .eq('store_id', storeId),

      // 3. Daily counts for completion rate
      context.supabase
        .from('daily_counts')
        .select('count_date')
        .eq('store_id', storeId)
        .gte('count_date', startDate.toISOString().split('T')[0]),

      // 4. Category breakdown
      context.supabase
        .from('inventory_items')
        .select('category')
        .eq('store_id', storeId)
        .eq('is_active', true),
    ])

    if (stockHistoryResult.error) throw stockHistoryResult.error
    if (inventoryResult.error) throw inventoryResult.error

    const stockHistory = stockHistoryResult.data ?? []
    const inventory = inventoryResult.data ?? []
    const dailyCounts = dailyCountsResult.data ?? []
    const categoryItems = categoryResult.data ?? []

    // --- Compute analytics ---

    // 1. Stock activity by day (counts vs receptions)
    const activityByDay = new Map<string, { date: string; counts: number; receptions: number }>()

    // Pre-fill all days in range
    for (let i = 0; i <= days; i++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      activityByDay.set(dateStr, { date: dateStr, counts: 0, receptions: 0 })
    }

    for (const entry of stockHistory) {
      const dateStr = new Date(entry.created_at).toISOString().split('T')[0]
      const day = activityByDay.get(dateStr)
      if (day) {
        if (entry.action_type === 'Count') day.counts++
        else if (entry.action_type === 'Reception') day.receptions++
      }
    }

    // 2. Top moving items (most stock changes by absolute quantity)
    const itemMovement = new Map<string, { name: string; category: string | null; totalChange: number; changeCount: number }>()

    for (const entry of stockHistory) {
      const itemName = (entry.inventory_item as { name: string; category: string | null } | null)?.name ?? 'Unknown'
      const itemCategory = (entry.inventory_item as { name: string; category: string | null } | null)?.category ?? null
      const existing = itemMovement.get(entry.inventory_item_id)
      if (existing) {
        existing.totalChange += Math.abs(entry.quantity_change ?? 0)
        existing.changeCount++
      } else {
        itemMovement.set(entry.inventory_item_id, {
          name: itemName,
          category: itemCategory,
          totalChange: Math.abs(entry.quantity_change ?? 0),
          changeCount: 1,
        })
      }
    }

    const topMovingItems = Array.from(itemMovement.values())
      .sort((a, b) => b.totalChange - a.totalChange)
      .slice(0, 10)

    // 3. Category breakdown
    const categoryCounts = new Map<string, number>()
    for (const item of categoryItems) {
      const cat = item.category || 'Uncategorized'
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1)
    }

    const categoryBreakdown = Array.from(categoryCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // 4. Inventory health
    const total = inventory.length
    const outOfStock = inventory.filter(i => i.quantity === 0).length
    const lowStock = inventory.filter(i => i.par_level && i.quantity < i.par_level && i.quantity > 0).length
    const healthy = total - outOfStock - lowStock

    // 5. Count completion rate
    const countDatesSet = new Set(dailyCounts.map(d => d.count_date))
    const totalDaysInRange = days
    const daysCompleted = countDatesSet.size
    const completionRate = totalDaysInRange > 0 ? Math.round((daysCompleted / totalDaysInRange) * 100) : 0

    // 6. Stock value trend (total quantity over time, sampled from history)
    // Group history by day and compute running totals
    const totalQuantityByDay: { date: string; totalQuantity: number }[] = []
    const currentTotal = inventory.reduce((sum, item) => sum + item.quantity, 0)

    // Work backwards from current state using stock changes
    const changesByDay = new Map<string, number>()
    for (const entry of stockHistory) {
      const dateStr = new Date(entry.created_at).toISOString().split('T')[0]
      changesByDay.set(dateStr, (changesByDay.get(dateStr) ?? 0) + (entry.quantity_change ?? 0))
    }

    // Build running total backwards
    let runningTotal = currentTotal
    const sortedDays = Array.from(activityByDay.keys()).sort().reverse()
    const totals = new Map<string, number>()
    totals.set(sortedDays[0], runningTotal)

    for (let i = 0; i < sortedDays.length - 1; i++) {
      const dayChange = changesByDay.get(sortedDays[i]) ?? 0
      runningTotal -= dayChange
      totals.set(sortedDays[i + 1], Math.max(0, runningTotal))
    }

    for (const dateStr of Array.from(activityByDay.keys()).sort()) {
      totalQuantityByDay.push({
        date: dateStr,
        totalQuantity: totals.get(dateStr) ?? 0,
      })
    }

    return apiSuccess({
      period: { start: startDate.toISOString().split('T')[0], end: now.toISOString().split('T')[0], days },
      stockActivityByDay: Array.from(activityByDay.values()),
      topMovingItems,
      categoryBreakdown,
      inventoryHealth: { total, outOfStock, lowStock, healthy },
      countCompletionRate: { completed: daysCompleted, total: totalDaysInRange, rate: completionRate },
      stockValueTrend: totalQuantityByDay,
    }, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error fetching analytics:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to fetch analytics')
  }
}
