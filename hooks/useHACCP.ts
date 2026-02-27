'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCSRF } from '@/hooks/useCSRF'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────────

export interface HACCPTemplateItem {
  id?: string
  label: string
  type: 'yes_no' | 'temperature' | 'text'
  required: boolean
}

export interface HACCPTemplate {
  id: string
  store_id: string
  name: string
  frequency: string
  items: HACCPTemplateItem[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface HACCPCheck {
  id: string
  store_id: string
  template_id: string
  template_name?: string
  status: 'pass' | 'fail' | 'partial'
  completed_by: string
  completed_by_name?: string
  responses: Record<string, unknown>[]
  notes?: string
  created_at: string
}

export interface HACCPTemperatureLog {
  id: string
  store_id: string
  location_name: string
  temperature_celsius: number
  min_temp?: number | null
  max_temp?: number | null
  is_in_range: boolean
  recorded_by: string
  recorded_by_name?: string
  corrective_action?: string | null
  recorded_at: string
  created_at: string
}

export interface HACCPCorrectiveAction {
  id: string
  store_id: string
  description: string
  linked_check_id?: string | null
  linked_temp_log_id?: string | null
  action_taken?: string | null
  status: 'open' | 'resolved'
  created_by: string
  created_by_name?: string
  resolved_by?: string | null
  resolved_by_name?: string | null
  resolved_at?: string | null
  created_at: string
}

export interface HACCPDueCheck {
  id: string
  name: string
  frequency: string
}

export interface HACCPDashboardData {
  today: {
    total_checks: number
    passed_checks: number
    failed_checks: number
    out_of_range_temps: number
  }
  unresolved_corrective_actions: number
  compliance_score: number
  recent_checks: HACCPCheck[]
  recent_temp_alerts: HACCPTemperatureLog[]
  due_checks: HACCPDueCheck[]
}

export interface HACCPChecksParams {
  from?: string
  to?: string
  status?: string
}

export interface HACCPTemperatureParams {
  from?: string
  to?: string
  location?: string
  out_of_range_only?: boolean
}

export interface HACCPCorrectiveActionsParams {
  unresolved_only?: boolean
}

// ─── Query Hooks ─────────────────────────────────────────────

export function useHACCPTemplates(storeId: string | null) {
  return useQuery<HACCPTemplate[]>({
    queryKey: ['haccp-templates', storeId],
    queryFn: async () => {
      if (!storeId) throw new Error('Store ID is required')
      const res = await fetch(`/api/stores/${storeId}/haccp/templates?active_only=true`)
      if (!res.ok) throw new Error('Failed to fetch HACCP templates')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: !!storeId,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useHACCPChecks(storeId: string | null, params?: HACCPChecksParams) {
  return useQuery<HACCPCheck[]>({
    queryKey: ['haccp-checks', storeId, params],
    queryFn: async () => {
      if (!storeId) throw new Error('Store ID is required')
      const searchParams = new URLSearchParams()
      if (params?.from) searchParams.set('from', params.from)
      if (params?.to) searchParams.set('to', params.to)
      if (params?.status) searchParams.set('status', params.status)
      const qs = searchParams.toString()
      const res = await fetch(`/api/stores/${storeId}/haccp/checks${qs ? `?${qs}` : ''}`)
      if (!res.ok) throw new Error('Failed to fetch HACCP checks')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: !!storeId,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useHACCPTemperatureLogs(storeId: string | null, params?: HACCPTemperatureParams) {
  return useQuery<HACCPTemperatureLog[]>({
    queryKey: ['haccp-temperatures', storeId, params],
    queryFn: async () => {
      if (!storeId) throw new Error('Store ID is required')
      const searchParams = new URLSearchParams()
      if (params?.from) searchParams.set('from', params.from)
      if (params?.to) searchParams.set('to', params.to)
      if (params?.location) searchParams.set('location', params.location)
      if (params?.out_of_range_only) searchParams.set('out_of_range_only', 'true')
      const qs = searchParams.toString()
      const res = await fetch(`/api/stores/${storeId}/haccp/temperature-logs${qs ? `?${qs}` : ''}`)
      if (!res.ok) throw new Error('Failed to fetch temperature logs')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: !!storeId,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useHACCPCorrectiveActions(storeId: string | null, params?: HACCPCorrectiveActionsParams) {
  return useQuery<HACCPCorrectiveAction[]>({
    queryKey: ['haccp-corrective-actions', storeId, params],
    queryFn: async () => {
      if (!storeId) throw new Error('Store ID is required')
      const searchParams = new URLSearchParams()
      if (params?.unresolved_only) searchParams.set('unresolved_only', 'true')
      const qs = searchParams.toString()
      const res = await fetch(`/api/stores/${storeId}/haccp/corrective-actions${qs ? `?${qs}` : ''}`)
      if (!res.ok) throw new Error('Failed to fetch corrective actions')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: !!storeId,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useHACCPDashboard(storeId: string | null) {
  return useQuery<HACCPDashboardData>({
    queryKey: ['haccp-dashboard', storeId],
    queryFn: async () => {
      if (!storeId) throw new Error('Store ID is required')
      const res = await fetch(`/api/stores/${storeId}/haccp/dashboard`)
      if (!res.ok) throw new Error('Failed to fetch HACCP dashboard')
      const json = await res.json()
      return json.data
    },
    enabled: !!storeId,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  })
}

// ─── Mutation Hooks ──────────────────────────────────────────

export function useCreateHACCPTemplate(storeId: string | null) {
  const queryClient = useQueryClient()
  const { csrfFetch } = useCSRF()

  return useMutation({
    mutationFn: async (data: { name: string; frequency: string; items: HACCPTemplateItem[]; is_active?: boolean }) => {
      if (!storeId) throw new Error('Store ID is required')
      const res = await csrfFetch(`/api/stores/${storeId}/haccp/templates`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to create template')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['haccp-templates', storeId] })
      queryClient.invalidateQueries({ queryKey: ['haccp-dashboard', storeId] })
      toast.success('HACCP template created')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create template')
    },
  })
}

export function useSubmitHACCPCheck(storeId: string | null) {
  const queryClient = useQueryClient()
  const { csrfFetch } = useCSRF()

  return useMutation({
    mutationFn: async (data: { template_id: string; responses: Record<string, unknown>[]; notes?: string }) => {
      if (!storeId) throw new Error('Store ID is required')
      const res = await csrfFetch(`/api/stores/${storeId}/haccp/checks`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to submit check')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['haccp-checks', storeId] })
      queryClient.invalidateQueries({ queryKey: ['haccp-dashboard', storeId] })
      toast.success('HACCP check submitted')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to submit check')
    },
  })
}

export function useLogTemperature(storeId: string | null) {
  const queryClient = useQueryClient()
  const { csrfFetch } = useCSRF()

  return useMutation({
    mutationFn: async (data: { location_name: string; temperature_celsius: number; min_temp?: number; max_temp?: number; corrective_action?: string }) => {
      if (!storeId) throw new Error('Store ID is required')
      const res = await csrfFetch(`/api/stores/${storeId}/haccp/temperature-logs`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to log temperature')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['haccp-temperatures', storeId] })
      queryClient.invalidateQueries({ queryKey: ['haccp-dashboard', storeId] })
      toast.success('Temperature logged')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to log temperature')
    },
  })
}

export function useCreateCorrectiveAction(storeId: string | null) {
  const queryClient = useQueryClient()
  const { csrfFetch } = useCSRF()

  return useMutation({
    mutationFn: async (data: { description: string; linked_check_id?: string; linked_temp_log_id?: string }) => {
      if (!storeId) throw new Error('Store ID is required')
      const res = await csrfFetch(`/api/stores/${storeId}/haccp/corrective-actions`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to create corrective action')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['haccp-corrective-actions', storeId] })
      queryClient.invalidateQueries({ queryKey: ['haccp-dashboard', storeId] })
      toast.success('Corrective action created')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create corrective action')
    },
  })
}

export function useResolveCorrectiveAction(storeId: string | null) {
  const queryClient = useQueryClient()
  const { csrfFetch } = useCSRF()

  return useMutation({
    mutationFn: async ({ actionId, action_taken }: { actionId: string; action_taken: string }) => {
      if (!storeId) throw new Error('Store ID is required')
      const res = await csrfFetch(`/api/stores/${storeId}/haccp/corrective-actions/${actionId}`, {
        method: 'PUT',
        body: JSON.stringify({ action_taken }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to resolve corrective action')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['haccp-corrective-actions', storeId] })
      queryClient.invalidateQueries({ queryKey: ['haccp-dashboard', storeId] })
      toast.success('Corrective action resolved')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to resolve corrective action')
    },
  })
}
