import { useState, useEffect, useCallback } from 'react'
import type { NotificationPreference } from '@/types'
import { useCSRF } from './useCSRF'

interface UseNotificationPreferencesResult {
  preferences: NotificationPreference | null
  isLoading: boolean
  error: string | null
  updatePreferences: (updates: Partial<NotificationPreference>) => Promise<void>
  isUpdating: boolean
}

const DEFAULT_PREFERENCES: Omit<NotificationPreference, 'id' | 'store_id' | 'user_id' | 'created_at' | 'updated_at'> = {
  shift_assigned: true,
  shift_updated: true,
  shift_cancelled: true,
  payslip_available: true,
  po_supplier_update: true,
  delivery_received: true,
  removed_from_store: true,
}

export function useNotificationPreferences(storeId: string | null): UseNotificationPreferencesResult {
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { csrfFetch } = useCSRF()

  const fetchPreferences = useCallback(async () => {
    if (!storeId) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/stores/${storeId}/notification-preferences`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch notification preferences')
      }

      setPreferences(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notification preferences')
    } finally {
      setIsLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    fetchPreferences()
  }, [fetchPreferences])

  const updatePreferences = useCallback(async (updates: Partial<NotificationPreference>) => {
    if (!storeId) return

    try {
      setIsUpdating(true)
      setError(null)

      const response = await csrfFetch(`/api/stores/${storeId}/notification-preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update notification preferences')
      }

      setPreferences(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update notification preferences')
      throw err
    } finally {
      setIsUpdating(false)
    }
  }, [storeId, csrfFetch])

  return {
    preferences: preferences ?? (storeId ? { ...DEFAULT_PREFERENCES, store_id: storeId, user_id: '', id: '', created_at: '', updated_at: '' } as NotificationPreference : null),
    isLoading,
    error,
    updatePreferences,
    isUpdating,
  }
}
