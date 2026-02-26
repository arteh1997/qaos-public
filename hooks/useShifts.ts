'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabaseFetch } from '@/lib/supabase/client'
import { getCSRFHeaders } from '@/hooks/useCSRF'
import { Shift } from '@/types'
import { ShiftFormData } from '@/lib/validations/shift'
import { toast } from 'sonner'

export function useShifts(storeId?: string | null, userId?: string | null, dateRange?: { from: string; to: string } | null) {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchShifts = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
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

      const { data, error: fetchError } = await supabaseFetch<Shift>('shifts', {
        select: '*,store:stores!shifts_store_id_fkey(*),user:profiles!shifts_user_id_fkey(*)',
        order: 'start_time.desc',
        filter,
      })

      if (fetchError) {
        if (fetchError.message?.includes('does not exist')) {
          setShifts([])
          return
        }
        throw fetchError
      }

      setShifts(data || [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch shifts'))
    } finally {
      setIsLoading(false)
    }
  }, [storeId, userId, dateRange?.from, dateRange?.to])

  useEffect(() => {
    fetchShifts()
  }, [fetchShifts])

  const createShift = useCallback(async (data: ShiftFormData) => {
    const optimisticShift: Shift = {
      id: crypto.randomUUID(),
      store_id: data.store_id,
      user_id: data.user_id,
      start_time: data.start_time,
      end_time: data.end_time,
      notes: data.notes || null,
      clock_in_time: null,
      clock_out_time: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    setShifts(prev => [optimisticShift, ...prev])

    try {
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

      toast.success('Shift created successfully')
      fetchShifts()
    } catch (err) {
      setShifts(prev => prev.filter(s => s.id !== optimisticShift.id))
      toast.error('Failed to create shift: ' + (err instanceof Error ? err.message : 'Unknown error'))
      throw err
    }
  }, [fetchShifts])

  const updateShift = useCallback(async ({ id, data }: { id: string; data: Partial<ShiftFormData> }) => {
    setShifts(prev => prev.map(shift =>
      shift.id === id ? { ...shift, ...data, updated_at: new Date().toISOString() } : shift
    ))

    try {
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

      toast.success('Shift updated successfully')
      fetchShifts()
    } catch (err) {
      fetchShifts()
      toast.error('Failed to update shift: ' + (err instanceof Error ? err.message : 'Unknown error'))
      throw err
    }
  }, [fetchShifts])

  const deleteShift = useCallback(async (id: string) => {
    setShifts(prev => prev.filter(shift => shift.id !== id))

    try {
      const response = await fetch(`/api/shifts/${id}`, {
        method: 'DELETE',
        headers: getCSRFHeaders(),
        credentials: 'same-origin',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to delete shift')
      }

      toast.success('Shift deleted successfully')
    } catch (err) {
      fetchShifts()
      toast.error('Failed to delete shift: ' + (err instanceof Error ? err.message : 'Unknown error'))
      throw err
    }
  }, [fetchShifts])

  const clockIn = useCallback(async (shiftId: string) => {
    const now = new Date().toISOString()

    setShifts(prev => prev.map(shift =>
      shift.id === shiftId ? { ...shift, clock_in_time: now } : shift
    ))

    try {
      const response = await fetch(`/api/shifts/${shiftId}/clock-in`, {
        method: 'POST',
        headers: getCSRFHeaders(),
        credentials: 'same-origin',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to clock in')
      }

      toast.success('Clocked in successfully')
    } catch (err) {
      fetchShifts()
      toast.error('Failed to clock in: ' + (err instanceof Error ? err.message : 'Unknown error'))
      throw err
    }
  }, [fetchShifts])

  const clockOut = useCallback(async (shiftId: string) => {
    const now = new Date().toISOString()

    setShifts(prev => prev.map(shift =>
      shift.id === shiftId ? { ...shift, clock_out_time: now } : shift
    ))

    try {
      const response = await fetch(`/api/shifts/${shiftId}/clock-out`, {
        method: 'POST',
        headers: getCSRFHeaders(),
        credentials: 'same-origin',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to clock out')
      }

      toast.success('Clocked out successfully')
    } catch (err) {
      fetchShifts()
      toast.error('Failed to clock out: ' + (err instanceof Error ? err.message : 'Unknown error'))
      throw err
    }
  }, [fetchShifts])

  // Find current shift (started but not ended)
  const currentShift = shifts.find(shift => {
    const now = new Date()
    const start = new Date(shift.start_time)
    const end = new Date(shift.end_time)
    return now >= start && now <= end && !shift.clock_out_time
  })

  // Get today's shifts
  const today = new Date().toISOString().split('T')[0]
  const todayShifts = shifts.filter(shift => shift.start_time.startsWith(today))

  return {
    shifts,
    currentShift,
    todayShifts,
    isLoading,
    error,
    createShift,
    updateShift,
    deleteShift,
    clockIn,
    clockOut,
    refetch: fetchShifts,
  }
}
