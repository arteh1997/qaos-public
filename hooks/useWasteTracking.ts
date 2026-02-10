import { useState, useCallback } from 'react'
import { useCSRF } from './useCSRF'
import type { WasteLog, WasteReason } from '@/types'

export interface WasteReportItem {
  inventory_item_id: string
  quantity: number
  reason?: WasteReason
}

export interface WasteReportPayload {
  items: WasteReportItem[]
  notes?: string
}

interface WasteAnalytics {
  period: { from: string; to: string }
  summary: {
    total_quantity: number
    total_estimated_cost: number
    total_incidents: number
  }
  by_reason: Array<{
    reason: string
    count: number
    quantity: number
    estimated_cost: number
    percentage: number
  }>
  top_items: Array<{
    inventory_item_id: string
    item_name: string
    category: string | null
    unit_of_measure: string
    total_quantity: number
    total_cost: number
    incident_count: number
  }>
  daily_trend: Array<{
    date: string
    quantity: number
    cost: number
    incidents: number
  }>
}

interface UseWasteTrackingResult {
  submitWasteReport: (payload: WasteReportPayload) => Promise<void>
  isSubmitting: boolean
  submitError: string | null
  wasteHistory: WasteLog[]
  isLoadingHistory: boolean
  historyError: string | null
  fetchWasteHistory: (options?: { reason?: WasteReason; from?: string; to?: string; page?: number }) => Promise<void>
  analytics: WasteAnalytics | null
  isLoadingAnalytics: boolean
  analyticsError: string | null
  fetchAnalytics: (options?: { from?: string; to?: string }) => Promise<void>
}

export function useWasteTracking(storeId: string | null): UseWasteTrackingResult {
  const { csrfFetch } = useCSRF()

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // History state
  const [wasteHistory, setWasteHistory] = useState<WasteLog[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  // Analytics state
  const [analytics, setAnalytics] = useState<WasteAnalytics | null>(null)
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)

  const submitWasteReport = useCallback(async (payload: WasteReportPayload) => {
    if (!storeId) return

    try {
      setIsSubmitting(true)
      setSubmitError(null)

      const response = await csrfFetch(`/api/stores/${storeId}/waste`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit waste report')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit waste report'
      setSubmitError(message)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }, [storeId, csrfFetch])

  const fetchWasteHistory = useCallback(async (options?: {
    reason?: WasteReason
    from?: string
    to?: string
    page?: number
  }) => {
    if (!storeId) return

    try {
      setIsLoadingHistory(true)
      setHistoryError(null)

      const params = new URLSearchParams()
      if (options?.reason) params.set('reason', options.reason)
      if (options?.from) params.set('from', options.from)
      if (options?.to) params.set('to', options.to)
      if (options?.page) params.set('page', String(options.page))

      const queryString = params.toString()
      const url = `/api/stores/${storeId}/waste${queryString ? `?${queryString}` : ''}`

      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch waste history')
      }

      setWasteHistory(data.data || [])
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to fetch waste history')
    } finally {
      setIsLoadingHistory(false)
    }
  }, [storeId])

  const fetchAnalytics = useCallback(async (options?: { from?: string; to?: string }) => {
    if (!storeId) return

    try {
      setIsLoadingAnalytics(true)
      setAnalyticsError(null)

      const params = new URLSearchParams()
      if (options?.from) params.set('from', options.from)
      if (options?.to) params.set('to', options.to)

      const queryString = params.toString()
      const url = `/api/stores/${storeId}/waste-analytics${queryString ? `?${queryString}` : ''}`

      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch waste analytics')
      }

      setAnalytics(data.data)
    } catch (err) {
      setAnalyticsError(err instanceof Error ? err.message : 'Failed to fetch waste analytics')
    } finally {
      setIsLoadingAnalytics(false)
    }
  }, [storeId])

  return {
    submitWasteReport,
    isSubmitting,
    submitError,
    wasteHistory,
    isLoadingHistory,
    historyError,
    fetchWasteHistory,
    analytics,
    isLoadingAnalytics,
    analyticsError,
    fetchAnalytics,
  }
}
