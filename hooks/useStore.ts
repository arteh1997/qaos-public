'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabaseFetch } from '@/lib/supabase/client'
import { Store } from '@/types'

export function useStore(storeId: string | null) {
  const [data, setData] = useState<Store | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchStore = useCallback(async () => {
    if (!storeId) {
      setData(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { data: storeData, error: fetchError } = await supabaseFetch<Store>('stores', {
        filter: { id: `eq.${storeId}` },
      })

      if (fetchError) throw fetchError

      // Return first item or null if not found
      setData(storeData && storeData.length > 0 ? storeData[0] : null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch store'))
    } finally {
      setIsLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    fetchStore()
  }, [fetchStore])

  return {
    data,
    isLoading,
    error,
    refetch: fetchStore,
  }
}
