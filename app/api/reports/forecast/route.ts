import { NextRequest } from 'next/server'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { withApiAuth, canAccessStore } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest, apiForbidden } from '@/lib/api/response'
import { forecastItem, type ForecastResult } from '@/lib/forecasting/engine'

/**
 * GET /api/reports/forecast - AI-Powered Demand Forecasting
 *
 * Query params:
 *   - store_id (required): UUID of the store
 *   - days (optional, default 30): Historical days to analyze (max 90)
 *   - forecast_days (optional, default 14): Days to forecast forward (max 30)
 *   - item_id (optional): Specific inventory item to forecast (returns all if omitted)
 *   - risk_filter (optional): Filter by risk level (low, medium, high, critical)
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
    const historyDays = Math.min(Math.max(7, parseInt(searchParams.get('days') ?? '30', 10)), 90)
    const forecastDays = Math.min(Math.max(1, parseInt(searchParams.get('forecast_days') ?? '14', 10)), 30)
    const itemId = searchParams.get('item_id')
    const riskFilter = searchParams.get('risk_filter')

    if (!storeId) {
      return apiBadRequest('store_id is required', context.requestId)
    }

    if (!canAccessStore(context, storeId)) {
      return apiForbidden('Access denied to this store', context.requestId)
    }

    // Fetch inventory items with current quantities
    let inventoryQuery = context.supabase
      .from('store_inventory')
      .select(`
        id, store_id, quantity, par_level, unit_cost,
        inventory_item:inventory_items(id, name, category, unit_of_measure, is_active)
      `)
      .eq('store_id', storeId)

    if (itemId) {
      inventoryQuery = inventoryQuery.eq('inventory_item_id', itemId)
    }

    const { data: inventoryData, error: inventoryError } = await inventoryQuery

    if (inventoryError) throw inventoryError

    // Filter to active items
    const activeItems = (inventoryData ?? []).filter(item => {
      const inv = item.inventory_item as { is_active: boolean } | null
      return inv?.is_active !== false
    })

    if (activeItems.length === 0) {
      return apiSuccess({
        forecasts: [],
        summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
        period: { historyDays, forecastDays },
      }, { requestId: context.requestId })
    }

    // Fetch stock history for all relevant items
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - historyDays)

    const itemIds = activeItems.map(item => {
      const inv = item.inventory_item as { id: string }
      return inv.id
    })

    const { data: stockHistory, error: historyError } = await context.supabase
      .from('stock_history')
      .select('inventory_item_id, action_type, quantity_change, created_at')
      .eq('store_id', storeId)
      .in('inventory_item_id', itemIds)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })

    if (historyError) throw historyError

    // Group history by item
    const historyByItem = new Map<string, Array<{
      action_type: string
      quantity_change: number | null
      created_at: string
    }>>()

    for (const entry of stockHistory ?? []) {
      const itemHistory = historyByItem.get(entry.inventory_item_id) ?? []
      itemHistory.push({
        action_type: entry.action_type,
        quantity_change: entry.quantity_change,
        created_at: entry.created_at,
      })
      historyByItem.set(entry.inventory_item_id, itemHistory)
    }

    // Generate forecast for each item
    const forecasts: ForecastResult[] = []

    for (const item of activeItems) {
      const inv = item.inventory_item as {
        id: string
        name: string
        category: string | null
        unit_of_measure: string
      }

      const itemHistory = historyByItem.get(inv.id) ?? []

      const result = forecastItem({
        itemId: inv.id,
        itemName: inv.name,
        category: inv.category,
        unitOfMeasure: inv.unit_of_measure,
        currentQuantity: item.quantity,
        parLevel: item.par_level,
        unitCost: item.unit_cost,
        history: itemHistory,
        historyDays,
        forecastDays,
      })

      forecasts.push(result)
    }

    // Apply risk filter if specified
    let filteredForecasts = forecasts
    if (riskFilter) {
      const validLevels = ['low', 'medium', 'high', 'critical']
      if (validLevels.includes(riskFilter)) {
        filteredForecasts = forecasts.filter(f => f.riskLevel === riskFilter)
      }
    }

    // Sort by risk (critical first) then by days until stockout
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    filteredForecasts.sort((a, b) => {
      const riskDiff = riskOrder[a.riskLevel] - riskOrder[b.riskLevel]
      if (riskDiff !== 0) return riskDiff
      // Then by stockout proximity
      const aStockout = a.daysUntilStockout ?? 999
      const bStockout = b.daysUntilStockout ?? 999
      return aStockout - bStockout
    })

    // Summary counts
    const summary = {
      total: forecasts.length,
      critical: forecasts.filter(f => f.riskLevel === 'critical').length,
      high: forecasts.filter(f => f.riskLevel === 'high').length,
      medium: forecasts.filter(f => f.riskLevel === 'medium').length,
      low: forecasts.filter(f => f.riskLevel === 'low').length,
    }

    return apiSuccess({
      forecasts: filteredForecasts,
      summary,
      period: { historyDays, forecastDays },
    }, { requestId: context.requestId })
  } catch (error) {
    console.error('Forecast API error:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to generate forecast')
  }
}
