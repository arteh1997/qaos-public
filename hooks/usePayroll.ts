'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCSRF } from './useCSRF'
import { toast } from 'sonner'
import type { PayRun, EarningsSummary } from '@/types'

// ─── Types ───────────────────────────────────────────────────

export interface StaffRate {
  id: string
  user_id: string
  role: string
  hourly_rate: number | null
  is_billing_owner: boolean
  user: { id: string; full_name: string | null; email: string } | null
}

interface EarningsResponse {
  earnings: EarningsSummary[]
  totals: {
    total_hours: number
    total_pay: number
    staff_count: number
    shift_count: number
  }
}

// ─── Staff Rates ─────────────────────────────────────────────

export function useStaffRates(storeId: string | null) {
  const queryClient = useQueryClient()
  const { csrfFetch } = useCSRF()

  const query = useQuery<StaffRate[]>({
    queryKey: ['payroll-rates', storeId],
    queryFn: async () => {
      if (!storeId) throw new Error('Store ID is required')
      const res = await fetch(`/api/stores/${storeId}/payroll/rates`)
      if (!res.ok) throw new Error('Failed to fetch rates')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: !!storeId,
    staleTime: 30_000,
  })

  const updateRate = useMutation({
    mutationFn: async ({ userId, hourlyRate }: { userId: string; hourlyRate: number }) => {
      if (!storeId) throw new Error('Store ID is required')
      const res = await csrfFetch(`/api/stores/${storeId}/payroll/rates/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ hourly_rate: hourlyRate }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to update rate')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-rates', storeId] })
      toast.success('Hourly rate updated')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update rate')
    },
  })

  return {
    rates: query.data ?? [],
    isLoading: query.isLoading,
    updateRate: updateRate.mutate,
    isUpdating: updateRate.isPending,
  }
}

// ─── Earnings ────────────────────────────────────────────────

export function useEarnings(storeId: string | null, from: string, to: string) {
  return useQuery<EarningsResponse>({
    queryKey: ['payroll-earnings', storeId, from, to],
    queryFn: async () => {
      if (!storeId) throw new Error('Store ID is required')
      const res = await fetch(`/api/stores/${storeId}/payroll/earnings?from=${from}&to=${to}`)
      if (!res.ok) throw new Error('Failed to fetch earnings')
      const json = await res.json()
      return json.data
    },
    enabled: !!storeId && !!from && !!to,
    staleTime: 30_000,
  })
}

// ─── Pay Runs ────────────────────────────────────────────────

export function usePayRuns(storeId: string | null) {
  return useQuery<PayRun[]>({
    queryKey: ['pay-runs', storeId],
    queryFn: async () => {
      if (!storeId) throw new Error('Store ID is required')
      const res = await fetch(`/api/stores/${storeId}/payroll/pay-runs`)
      if (!res.ok) throw new Error('Failed to fetch pay runs')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: !!storeId,
    staleTime: 30_000,
  })
}

export function usePayRunDetail(storeId: string | null, payRunId: string | null) {
  return useQuery<PayRun>({
    queryKey: ['pay-run', storeId, payRunId],
    queryFn: async () => {
      if (!storeId || !payRunId) throw new Error('Store ID and Pay Run ID are required')
      const res = await fetch(`/api/stores/${storeId}/payroll/pay-runs/${payRunId}`)
      if (!res.ok) throw new Error('Failed to fetch pay run')
      const json = await res.json()
      return json.data
    },
    enabled: !!storeId && !!payRunId,
    staleTime: 30_000,
  })
}

export function useCreatePayRun(storeId: string | null) {
  const queryClient = useQueryClient()
  const { csrfFetch } = useCSRF()

  return useMutation({
    mutationFn: async (data: { period_start: string; period_end: string; notes?: string }) => {
      if (!storeId) throw new Error('Store ID is required')
      const res = await csrfFetch(`/api/stores/${storeId}/payroll/pay-runs`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to create pay run')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay-runs', storeId] })
      toast.success('Pay run created')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create pay run')
    },
  })
}

export function useUpdatePayRun(storeId: string | null, payRunId: string | null) {
  const queryClient = useQueryClient()
  const { csrfFetch } = useCSRF()

  return useMutation({
    mutationFn: async (data: {
      status?: 'approved' | 'paid'
      notes?: string
      items?: Array<{ user_id: string; adjustments?: number; adjustment_notes?: string }>
    }) => {
      if (!storeId || !payRunId) throw new Error('Store ID and Pay Run ID are required')
      const res = await csrfFetch(`/api/stores/${storeId}/payroll/pay-runs/${payRunId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to update pay run')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay-runs', storeId] })
      queryClient.invalidateQueries({ queryKey: ['pay-run', storeId, payRunId] })
      toast.success('Pay run updated')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update pay run')
    },
  })
}

export function useDeletePayRun(storeId: string | null) {
  const queryClient = useQueryClient()
  const { csrfFetch } = useCSRF()

  return useMutation({
    mutationFn: async (payRunId: string) => {
      if (!storeId) throw new Error('Store ID is required')
      const res = await csrfFetch(`/api/stores/${storeId}/payroll/pay-runs/${payRunId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to delete pay run')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay-runs', storeId] })
      toast.success('Pay run deleted')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete pay run')
    },
  })
}
