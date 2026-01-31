'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabaseFetch, supabaseInsert, supabaseUpdate, supabaseDelete } from '@/lib/supabase/client'
import { Shift } from '@/types'
import { ShiftFormData } from '@/lib/validations/shift'
import { sanitizeNotes } from '@/lib/utils'
import { toast } from 'sonner'

export function useShifts(storeId?: string | null, userId?: string | null) {
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

      const { data, error: fetchError } = await supabaseFetch<Shift>('shifts', {
        select: '*,store:stores!shifts_store_id_fkey(*),user:profiles!shifts_user_id_fkey(*)',
        order: 'start_time.desc',
        filter,
      })

      if (fetchError) {
        // Table might not exist yet
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
  }, [storeId, userId])

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

    // Optimistic update
    setShifts(prev => [optimisticShift, ...prev])

    try {
      const { error } = await supabaseInsert('shifts', {
        store_id: data.store_id,
        user_id: data.user_id,
        start_time: data.start_time,
        end_time: data.end_time,
        notes: sanitizeNotes(data.notes),
      })

      if (error) throw error
      toast.success('Shift created successfully')
      // Refetch to get relations
      fetchShifts()
    } catch (err) {
      // Rollback
      setShifts(prev => prev.filter(s => s.id !== optimisticShift.id))
      toast.error('Failed to create shift: ' + (err instanceof Error ? err.message : 'Unknown error'))
      throw err
    }
  }, [fetchShifts])

  const updateShift = useCallback(async ({ id, data }: { id: string; data: Partial<ShiftFormData> }) => {
    const sanitizedData: Record<string, unknown> = {
      ...data,
      notes: data.notes !== undefined ? sanitizeNotes(data.notes) : undefined,
    }

    // Optimistic update
    setShifts(prev => prev.map(shift =>
      shift.id === id ? { ...shift, ...sanitizedData, updated_at: new Date().toISOString() } : shift
    ))

    try {
      const { error } = await supabaseUpdate('shifts', id, sanitizedData)

      if (error) throw error
      toast.success('Shift updated successfully')
      fetchShifts()
    } catch (err) {
      fetchShifts()
      toast.error('Failed to update shift: ' + (err instanceof Error ? err.message : 'Unknown error'))
      throw err
    }
  }, [fetchShifts])

  const deleteShift = useCallback(async (id: string) => {
    // Optimistic update
    setShifts(prev => prev.filter(shift => shift.id !== id))

    try {
      const { error } = await supabaseDelete('shifts', id)

      if (error) throw error
      toast.success('Shift deleted successfully')
    } catch (err) {
      fetchShifts()
      toast.error('Failed to delete shift: ' + (err instanceof Error ? err.message : 'Unknown error'))
      throw err
    }
  }, [fetchShifts])

  const clockIn = useCallback(async (shiftId: string) => {
    const now = new Date().toISOString()

    // Optimistic update
    setShifts(prev => prev.map(shift =>
      shift.id === shiftId ? { ...shift, clock_in_time: now } : shift
    ))

    try {
      const { error } = await supabaseUpdate('shifts', shiftId, { clock_in_time: now })

      if (error) throw error
      toast.success('Clocked in successfully')
    } catch (err) {
      fetchShifts()
      toast.error('Failed to clock in: ' + (err instanceof Error ? err.message : 'Unknown error'))
      throw err
    }
  }, [fetchShifts])

  const clockOut = useCallback(async (shiftId: string) => {
    const now = new Date().toISOString()

    // Optimistic update
    setShifts(prev => prev.map(shift =>
      shift.id === shiftId ? { ...shift, clock_out_time: now } : shift
    ))

    try {
      const { error } = await supabaseUpdate('shifts', shiftId, { clock_out_time: now })

      if (error) throw error
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
