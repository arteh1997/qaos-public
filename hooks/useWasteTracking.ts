import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCSRFHeaders } from '@/hooks/useCSRF'
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
  const queryClient = useQueryClient()

  // History query
  const historyQuery = useQuery({
    queryKey: ['waste-history', storeId],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/waste`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.message || 'Failed to fetch waste history')

      return (data.data || []) as WasteLog[]
    },
    enabled: !!storeId,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  })

  // Analytics query
  const analyticsQuery = useQuery({
    queryKey: ['waste-analytics', storeId],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/waste-analytics`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.message || 'Failed to fetch waste analytics')

      return data.data as WasteAnalytics
    },
    enabled: !!storeId,
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
  })

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (payload: WasteReportPayload) => {
      if (!storeId) throw new Error('No store selected')

      const response = await fetch(`/api/stores/${storeId}/waste`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeaders() },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit waste report')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waste-history', storeId] })
      queryClient.invalidateQueries({ queryKey: ['waste-analytics', storeId] })
    },
  })

  // Backward-compatible fetchWasteHistory with filter options
  const fetchWasteHistory = async (options?: { reason?: WasteReason; from?: string; to?: string; page?: number }) => {
    if (options && Object.keys(options).length > 0) {
      if (!storeId) return
      const params = new URLSearchParams()
      if (options.reason) params.set('reason', options.reason)
      if (options.from) params.set('from', options.from)
      if (options.to) params.set('to', options.to)
      if (options.page) params.set('page', String(options.page))
      const queryString = params.toString()
      const url = `/api/stores/${storeId}/waste${queryString ? `?${queryString}` : ''}`
      const response = await fetch(url)
      const data = await response.json()
      if (response.ok) {
        queryClient.setQueryData(['waste-history', storeId], data.data || [])
      }
    } else {
      await historyQuery.refetch()
    }
  }

  // Backward-compatible fetchAnalytics with date range
  const fetchAnalytics = async (options?: { from?: string; to?: string }) => {
    if (options && Object.keys(options).length > 0) {
      if (!storeId) return
      const params = new URLSearchParams()
      if (options.from) params.set('from', options.from)
      if (options.to) params.set('to', options.to)
      const queryString = params.toString()
      const url = `/api/stores/${storeId}/waste-analytics${queryString ? `?${queryString}` : ''}`
      const response = await fetch(url)
      const data = await response.json()
      if (response.ok) {
        queryClient.setQueryData(['waste-analytics', storeId], data.data)
      }
    } else {
      await analyticsQuery.refetch()
    }
  }

  return {
    submitWasteReport: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
    submitError: submitMutation.error?.message ?? null,
    wasteHistory: historyQuery.data || [],
    isLoadingHistory: historyQuery.isLoading,
    historyError: historyQuery.error?.message ?? null,
    fetchWasteHistory,
    analytics: analyticsQuery.data ?? null,
    isLoadingAnalytics: analyticsQuery.isLoading,
    analyticsError: analyticsQuery.error?.message ?? null,
    fetchAnalytics,
  }
}
