'use client'

import { useState, useEffect, useCallback } from 'react'

export interface AnalyticsData {
  period: { start: string; end: string; days: number }
  stockActivityByDay: { date: string; counts: number; receptions: number }[]
  topMovingItems: { name: string; category: string | null; totalChange: number; changeCount: number }[]
  categoryBreakdown: { name: string; count: number }[]
  inventoryHealth: { total: number; outOfStock: number; lowStock: number; healthy: number }
  countCompletionRate: { completed: number; total: number; rate: number }
  stockValueTrend: { date: string; totalQuantity: number }[]
}

export function useAnalytics(storeId: string | null, days: number = 30) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchAnalytics = useCallback(async () => {
    if (!storeId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/reports/analytics?store_id=${storeId}&days=${days}`)
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.message || 'Failed to fetch analytics')
      }

      setData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch analytics'))
    } finally {
      setIsLoading(false)
    }
  }, [storeId, days])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  return { data, isLoading, error, refetch: fetchAnalytics }
}
