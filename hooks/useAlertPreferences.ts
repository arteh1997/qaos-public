import { useState, useEffect, useCallback } from 'react'
import type { AlertPreferences } from '@/types'
import { useCSRF } from './useCSRF'

interface UseAlertPreferencesResult {
  preferences: AlertPreferences | null
  isLoading: boolean
  error: string | null
  updatePreferences: (updates: Partial<AlertPreferences>) => Promise<void>
  isUpdating: boolean
}

const DEFAULT_PREFERENCES: Omit<AlertPreferences, 'id' | 'store_id' | 'user_id' | 'created_at' | 'updated_at'> = {
  low_stock_enabled: true,
  critical_stock_enabled: true,
  missing_count_enabled: true,
  low_stock_threshold: 1.0,
  alert_frequency: 'daily',
  email_enabled: true,
  preferred_hour: 8,
}

export function useAlertPreferences(storeId: string | null): UseAlertPreferencesResult {
  const [preferences, setPreferences] = useState<AlertPreferences | null>(null)
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

      const response = await fetch(`/api/stores/${storeId}/alert-preferences`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch preferences')
      }

      setPreferences(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch preferences')
    } finally {
      setIsLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    fetchPreferences()
  }, [fetchPreferences])

  const updatePreferences = useCallback(async (updates: Partial<AlertPreferences>) => {
    if (!storeId) return

    try {
      setIsUpdating(true)
      setError(null)

      const response = await csrfFetch(`/api/stores/${storeId}/alert-preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update preferences')
      }

      setPreferences(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preferences')
      throw err
    } finally {
      setIsUpdating(false)
    }
  }, [storeId, csrfFetch])

  return {
    preferences: preferences ?? (storeId ? { ...DEFAULT_PREFERENCES, store_id: storeId, user_id: '', id: '', created_at: '', updated_at: '' } as AlertPreferences : null),
    isLoading,
    error,
    updatePreferences,
    isUpdating,
  }
}
