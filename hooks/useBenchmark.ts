'use client'

import { useState, useEffect, useCallback } from 'react'

export interface StoreAnalytics {
  storeId: string
  storeName: string
  inventoryHealth: {
    totalItems: number
    outOfStock: number
    lowStock: number
    healthy: number
    healthScore: number
  }
  activity: {
    totalCounts: number
    totalReceptions: number
    totalActivity: number
    avgDailyActivity: number
  }
  countCompletionRate: number
  inventory: {
    totalValue: number
    totalUnits: number
  }
  waste: {
    totalUnits: number
  }
  activityTrend: { date: string; count: number }[]
}

export interface StoreRanking {
  storeId: string
  storeName: string
  rank: number
  value: number
}

export interface BenchmarkData {
  period: { start: string; end: string; days: number }
  stores: StoreAnalytics[]
  rankings: {
    healthScore: StoreRanking[]
    countCompletion: StoreRanking[]
    activity: StoreRanking[]
    inventoryValue: StoreRanking[]
  }
  averages: {
    healthScore: number
    countCompletionRate: number
    avgDailyActivity: number
    totalValue: number
  }
}

export function useBenchmark(
  storeIds: string[],
  days: number = 30,
  dateRange?: { startDate: string; endDate: string } | null,
) {
  const [data, setData] = useState<BenchmarkData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchBenchmark = useCallback(async () => {
    if (storeIds.length === 0) {
      setData(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ store_ids: storeIds.join(',') })
      if (dateRange) {
        params.set('start_date', dateRange.startDate)
        params.set('end_date', dateRange.endDate)
      } else {
        params.set('days', String(days))
      }

      const response = await fetch(`/api/reports/benchmark?${params}`)
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.message || 'Failed to fetch benchmark data')
      }

      setData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch benchmark data'))
    } finally {
      setIsLoading(false)
    }
  }, [storeIds.join(','), days, dateRange?.startDate, dateRange?.endDate])

  useEffect(() => {
    fetchBenchmark()
  }, [fetchBenchmark])

  return { data, isLoading, error, refetch: fetchBenchmark }
}
