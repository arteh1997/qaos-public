import { NextRequest } from 'next/server'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { withApiAuth, canAccessStore } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest } from '@/lib/api/response'

/**
 * GET /api/reports/benchmark - Multi-store comparative analytics
 *
 * Query params:
 *   - store_ids (required): Comma-separated store IDs to compare
 *   - days (optional): Number of days to look back (default: 30, max: 90)
 *
 * Returns:
 *   - stores[]: Per-store analytics with KPIs
 *   - rankings: Store rankings by various metrics
 *   - averages: Cross-store average metrics
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
    const storeIdsParam = searchParams.get('store_ids')
    const days = Math.min(parseInt(searchParams.get('days') ?? '30', 10) || 30, 90)

    if (!storeIdsParam) {
      return apiBadRequest('store_ids is required (comma-separated)', context.requestId)
    }

    const storeIds = storeIdsParam.split(',').filter(Boolean)

    if (storeIds.length < 1) {
      return apiBadRequest('At least one store ID is required', context.requestId)
    }

    if (storeIds.length > 10) {
      return apiBadRequest('Maximum 10 stores can be compared', context.requestId)
    }

    // Verify access to all stores
    for (const storeId of storeIds) {
      if (!canAccessStore(context, storeId)) {
        return apiBadRequest(`Access denied to store ${storeId}`, context.requestId)
      }
    }

    const now = new Date()
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString()
    const startDateDay = startDate.toISOString().split('T')[0]

    // Fetch store names
    const { data: stores, error: storesError } = await context.supabase
      .from('stores')
      .select('id,name')
      .in('id', storeIds)

    if (storesError) throw storesError

    const storeNameMap = new Map(
      (stores ?? []).map(s => [s.id, s.name])
    )

    // Fetch all data in parallel across all stores
    const [
      stockHistoryResult,
      inventoryResult,
      dailyCountsResult,
      wasteResult,
    ] = await Promise.all([
      // Stock history for all stores
      context.supabase
        .from('stock_history')
        .select('store_id,action_type,quantity_change,created_at')
        .in('store_id', storeIds)
        .gte('created_at', startDateStr),

      // Current inventory for all stores
      context.supabase
        .from('store_inventory')
        .select('store_id,quantity,par_level,unit_cost')
        .in('store_id', storeIds),

      // Daily counts for all stores
      context.supabase
        .from('daily_counts')
        .select('store_id,count_date')
        .in('store_id', storeIds)
        .gte('count_date', startDateDay),

      // Waste tracking (if table exists) - use stock_history with waste action
      context.supabase
        .from('stock_history')
        .select('store_id,quantity_change,created_at')
        .in('store_id', storeIds)
        .eq('action_type', 'Waste')
        .gte('created_at', startDateStr),
    ])

    if (stockHistoryResult.error) throw stockHistoryResult.error
    if (inventoryResult.error) throw inventoryResult.error

    const stockHistory = stockHistoryResult.data ?? []
    const inventory = inventoryResult.data ?? []
    const dailyCounts = dailyCountsResult.data ?? []
    const wasteHistory = wasteResult.data ?? []

    // Compute per-store analytics
    const storeAnalytics = storeIds.map(storeId => {
      const storeName = storeNameMap.get(storeId) ?? 'Unknown Store'
      const storeHistory = stockHistory.filter(h => h.store_id === storeId)
      const storeInventory = inventory.filter(i => i.store_id === storeId)
      const storeDailyCounts = dailyCounts.filter(d => d.store_id === storeId)
      const storeWaste = wasteHistory.filter(w => w.store_id === storeId)

      // Inventory health
      const totalItems = storeInventory.length
      const outOfStock = storeInventory.filter(i => i.quantity === 0).length
      const lowStock = storeInventory.filter(i => i.par_level && i.quantity < i.par_level && i.quantity > 0).length
      const healthy = totalItems - outOfStock - lowStock
      const healthScore = totalItems > 0 ? Math.round((healthy / totalItems) * 100) : 0

      // Activity counts
      const totalCounts = storeHistory.filter(h => h.action_type === 'Count').length
      const totalReceptions = storeHistory.filter(h => h.action_type === 'Reception').length
      const totalActivity = storeHistory.length

      // Count completion rate
      const uniqueCountDays = new Set(storeDailyCounts.map(d => d.count_date)).size
      const countCompletionRate = days > 0 ? Math.round((uniqueCountDays / days) * 100) : 0

      // Inventory value
      const totalValue = storeInventory.reduce(
        (sum, item) => sum + (item.quantity * (item.unit_cost ?? 0)),
        0
      )
      const totalUnits = storeInventory.reduce((sum, item) => sum + item.quantity, 0)

      // Waste (total units wasted)
      const totalWaste = storeWaste.reduce(
        (sum, w) => sum + Math.abs(w.quantity_change ?? 0),
        0
      )

      // Stock activity by day (last 14 days for trend)
      const activityByDay: { date: string; count: number }[] = []
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        const dayActivity = storeHistory.filter(h => {
          const hDate = new Date(h.created_at).toISOString().split('T')[0]
          return hDate === dateStr
        }).length
        activityByDay.push({ date: dateStr, count: dayActivity })
      }

      return {
        storeId,
        storeName,
        inventoryHealth: {
          totalItems,
          outOfStock,
          lowStock,
          healthy,
          healthScore,
        },
        activity: {
          totalCounts,
          totalReceptions,
          totalActivity,
          avgDailyActivity: days > 0 ? Math.round((totalActivity / days) * 10) / 10 : 0,
        },
        countCompletionRate,
        inventory: {
          totalValue: Math.round(totalValue * 100) / 100,
          totalUnits,
        },
        waste: {
          totalUnits: totalWaste,
        },
        activityTrend: activityByDay,
      }
    })

    // Compute rankings
    const rankings = {
      healthScore: [...storeAnalytics].sort((a, b) => b.inventoryHealth.healthScore - a.inventoryHealth.healthScore)
        .map((s, i) => ({ storeId: s.storeId, storeName: s.storeName, rank: i + 1, value: s.inventoryHealth.healthScore })),
      countCompletion: [...storeAnalytics].sort((a, b) => b.countCompletionRate - a.countCompletionRate)
        .map((s, i) => ({ storeId: s.storeId, storeName: s.storeName, rank: i + 1, value: s.countCompletionRate })),
      activity: [...storeAnalytics].sort((a, b) => b.activity.totalActivity - a.activity.totalActivity)
        .map((s, i) => ({ storeId: s.storeId, storeName: s.storeName, rank: i + 1, value: s.activity.totalActivity })),
      inventoryValue: [...storeAnalytics].sort((a, b) => b.inventory.totalValue - a.inventory.totalValue)
        .map((s, i) => ({ storeId: s.storeId, storeName: s.storeName, rank: i + 1, value: s.inventory.totalValue })),
    }

    // Compute averages
    const storeCount = storeAnalytics.length
    const averages = {
      healthScore: storeCount > 0
        ? Math.round(storeAnalytics.reduce((s, a) => s + a.inventoryHealth.healthScore, 0) / storeCount)
        : 0,
      countCompletionRate: storeCount > 0
        ? Math.round(storeAnalytics.reduce((s, a) => s + a.countCompletionRate, 0) / storeCount)
        : 0,
      avgDailyActivity: storeCount > 0
        ? Math.round(storeAnalytics.reduce((s, a) => s + a.activity.avgDailyActivity, 0) / storeCount * 10) / 10
        : 0,
      totalValue: storeCount > 0
        ? Math.round(storeAnalytics.reduce((s, a) => s + a.inventory.totalValue, 0) / storeCount * 100) / 100
        : 0,
    }

    return apiSuccess({
      period: { start: startDateDay, end: now.toISOString().split('T')[0], days },
      stores: storeAnalytics,
      rankings,
      averages,
    }, { requestId: context.requestId })
  } catch (error) {
    console.error('Error fetching benchmark data:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to fetch benchmark data')
  }
}
