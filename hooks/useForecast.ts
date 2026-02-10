'use client'

import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { ForecastResult } from '@/lib/forecasting/engine'

export interface ForecastData {
  forecasts: ForecastResult[]
  summary: {
    total: number
    critical: number
    high: number
    medium: number
    low: number
  }
  period: {
    historyDays: number
    forecastDays: number
  }
}

interface UseForecastOptions {
  storeId: string | null
  days?: number
  forecastDays?: number
  itemId?: string
  riskFilter?: string
  enabled?: boolean
}

export function useForecast({
  storeId,
  days = 30,
  forecastDays = 14,
  itemId,
  riskFilter,
  enabled = true,
}: UseForecastOptions) {
  const fetchForecast = useCallback(async (): Promise<ForecastData> => {
    if (!storeId) throw new Error('Store ID is required')

    const params = new URLSearchParams({
      store_id: storeId,
      days: String(days),
      forecast_days: String(forecastDays),
    })

    if (itemId) params.set('item_id', itemId)
    if (riskFilter) params.set('risk_filter', riskFilter)

    const response = await fetch(`/api/reports/forecast?${params}`)

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Forecast request failed' }))
      throw new Error(error.message || `Forecast failed: ${response.status}`)
    }

    const json = await response.json()
    return json.data
  }, [storeId, days, forecastDays, itemId, riskFilter])

  return useQuery<ForecastData>({
    queryKey: ['forecast', storeId, days, forecastDays, itemId, riskFilter],
    queryFn: fetchForecast,
    enabled: enabled && !!storeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
  })
}
