'use client'

import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCSRFHeaders } from '@/hooks/useCSRF'
import { Shift } from '@/types'
import { ShiftFormData } from '@/lib/validations/shift'
import { toast } from 'sonner'
import { supabaseFetch } from '@/lib/supabase/client'

async function fetchShiftsData(
  storeId?: string | null,
  userId?: string | null,
  dateRange?: { from: string; to: string } | null
): Promise<Shift[]> {
  const filter: Record<string, string> = {}

  if (storeId) {
    filter['store_id'] = `eq.${storeId}`
  }

  if (userId) {
    filter['user_id'] = `eq.${userId}`
  }

  if (dateRange?.from && dateRange?.to) {
    filter['and'] = `(start_time.gte.${dateRange.from},start_time.lte.${dateRange.to})`
  }

  const { data, error } = await supabaseFetch<Shift>('shifts', {
    select: '*,store:stores!shifts_store_id_fkey(*),user:profiles!shifts_user_id_fkey(*)',
    order: 'start_time.desc',
    filter,
  })

  if (error) {
    if (error.message?.includes('does not exist')) {
      return []
    }
    throw error
  }

  return data || []
}

export function useShifts(storeId?: string | null, userId?: string | null, dateRange?: { from: string; to: string } | null) {
  const queryClient = useQueryClient()
  const queryKey = ['shifts', storeId, userId, dateRange?.from, dateRange?.to]

  const query = useQuery({
    queryKey,
    queryFn: () => fetchShiftsData(storeId, userId, dateRange),
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: async (data: ShiftFormData) => {
      const response = await fetch('/api/shifts', {
        method: 'POST',
        headers: getCSRFHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to create shift')
      }

      return response.json()
    },
    onSuccess: () => {
      toast.success('Shift created successfully')
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
    onError: (err) => {
      toast.error('Failed to create shift: ' + (err instanceof Error ? err.message : 'Unknown error'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ShiftFormData> }) => {
      const response = await fetch(`/api/shifts/${id}`, {
        method: 'PATCH',
        headers: getCSRFHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to update shift')
      }

      return response.json()
    },
    onSuccess: () => {
      toast.success('Shift updated successfully')
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
    onError: (err) => {
      toast.error('Failed to update shift: ' + (err instanceof Error ? err.message : 'Unknown error'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/shifts/${id}`, {
        method: 'DELETE',
        headers: getCSRFHeaders(),
        credentials: 'same-origin',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to delete shift')
      }

      return response.json()
    },
    onSuccess: () => {
      toast.success('Shift deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
    onError: (err) => {
      toast.error('Failed to delete shift: ' + (err instanceof Error ? err.message : 'Unknown error'))
    },
  })

  const clockInMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const response = await fetch(`/api/shifts/${shiftId}/clock-in`, {
        method: 'POST',
        headers: getCSRFHeaders(),
        credentials: 'same-origin',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to clock in')
      }

      return response.json()
    },
    onSuccess: () => {
      toast.success('Clocked in successfully')
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
    onError: (err) => {
      toast.error('Failed to clock in: ' + (err instanceof Error ? err.message : 'Unknown error'))
    },
  })

  const clockOutMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const response = await fetch(`/api/shifts/${shiftId}/clock-out`, {
        method: 'POST',
        headers: getCSRFHeaders(),
        credentials: 'same-origin',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to clock out')
      }

      return response.json()
    },
    onSuccess: () => {
      toast.success('Clocked out successfully')
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
    onError: (err) => {
      toast.error('Failed to clock out: ' + (err instanceof Error ? err.message : 'Unknown error'))
    },
  })

  const shifts = query.data || []

  // Find current shift (started but not ended)
  const currentShift = useMemo(() => shifts.find(shift => {
    const now = new Date()
    const start = new Date(shift.start_time)
    const end = new Date(shift.end_time)
    return now >= start && now <= end && !shift.clock_out_time
  }), [shifts])

  // Get today's shifts
  const todayShifts = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return shifts.filter(shift => shift.start_time.startsWith(today))
  }, [shifts])

  return {
    shifts,
    currentShift,
    todayShifts,
    isLoading: query.isLoading,
    error: query.error,
    createShift: createMutation.mutateAsync,
    updateShift: updateMutation.mutateAsync,
    deleteShift: deleteMutation.mutateAsync,
    clockIn: clockInMutation.mutateAsync,
    clockOut: clockOutMutation.mutateAsync,
    refetch: query.refetch,
  }
}
