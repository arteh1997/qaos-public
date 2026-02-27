'use client'

import { useQuery } from '@tanstack/react-query'

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
  const query = useQuery({
    queryKey: ['analytics', storeId, days],
    queryFn: async () => {
      const response = await fetch(`/api/reports/analytics?store_id=${storeId}&days=${days}`)
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.message || 'Failed to fetch analytics')
      }

      return json.data as AnalyticsData
    },
    enabled: !!storeId,
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
  })

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
