'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabaseFetch } from '@/lib/supabase/client'
import { StockHistory, LowStockItem, DailyCount } from '@/types'

export interface DateRange {
  from?: Date
  to?: Date
}

export function useStockHistory(storeId?: string | null, date?: string) {
  const [data, setData] = useState<StockHistory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchStockHistory = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const filter: Record<string, string> = {}

      if (storeId) {
        filter['store_id'] = `eq.${storeId}`
      }

      if (date) {
        const startOfDay = `${date}T00:00:00.000Z`
        const endOfDay = `${date}T23:59:59.999Z`
        filter['created_at'] = `gte.${startOfDay}`
        filter['and'] = `(created_at.lte.${endOfDay})`
      }

      const { data: historyData, error: fetchError } = await supabaseFetch<StockHistory>('stock_history', {
        select: '*,inventory_item:inventory_items!stock_history_inventory_item_id_fkey(*),store:stores!stock_history_store_id_fkey(*),performer:profiles!stock_history_performed_by_fkey(*)',
        order: 'created_at.desc',
        filter,
      })

      if (fetchError) {
        // Table might not exist yet
        if (fetchError.message?.includes('does not exist')) {
          setData([])
          return
        }
        throw fetchError
      }

      setData(historyData || [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch stock history'))
    } finally {
      setIsLoading(false)
    }
  }, [storeId, date])

  useEffect(() => {
    fetchStockHistory()
  }, [fetchStockHistory])

  return {
    data,
    isLoading,
    error,
    refetch: fetchStockHistory,
  }
}

/**
 * Hook for fetching stock history with date range support
 */
export function useStockHistoryRange(storeId?: string | null, dateRange?: DateRange) {
  const [data, setData] = useState<StockHistory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchStockHistory = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const filter: Record<string, string> = {}

      if (storeId) {
        filter['store_id'] = `eq.${storeId}`
      }

      if (dateRange?.from) {
        const startDate = dateRange.from.toISOString().split('T')[0]
        filter['created_at'] = `gte.${startDate}T00:00:00.000Z`
      }

      if (dateRange?.to) {
        const endDate = dateRange.to.toISOString().split('T')[0]
        filter['and'] = `(created_at.lte.${endDate}T23:59:59.999Z)`
      }

      const { data: historyData, error: fetchError } = await supabaseFetch<StockHistory>('stock_history', {
        select: '*,inventory_item:inventory_items!stock_history_inventory_item_id_fkey(*),store:stores!stock_history_store_id_fkey(*),performer:profiles!stock_history_performed_by_fkey(*)',
        order: 'created_at.desc',
        filter,
        range: { from: 0, to: 499 }, // Limit to 500 results for date ranges
      })

      if (fetchError) {
        if (fetchError.message?.includes('does not exist')) {
          setData([])
          return
        }
        throw fetchError
      }

      setData(historyData || [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch stock history'))
    } finally {
      setIsLoading(false)
    }
  }, [storeId, dateRange?.from, dateRange?.to])

  useEffect(() => {
    fetchStockHistory()
  }, [fetchStockHistory])

  return {
    data,
    isLoading,
    error,
    refetch: fetchStockHistory,
  }
}

export function useLowStockReport(storeId?: string | null) {
  const [data, setData] = useState<LowStockItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchLowStock = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const filter: Record<string, string> = { 'par_level': 'not.is.null' }
      if (storeId) {
        filter['store_id'] = `eq.${storeId}`
      }

      const { data: inventoryData, error: fetchError } = await supabaseFetch<{
        store_id: string
        inventory_item_id: string
        quantity: number
        par_level: number | null
        store: { id: string; name: string } | null
        inventory_item: { id: string; name: string; unit_of_measure: string } | null
      }>('store_inventory', {
        select: '*,store:stores(id,name),inventory_item:inventory_items(id,name,unit_of_measure)',
        filter,
      })

      if (fetchError) throw fetchError

      // Filter items below PAR level and format
      const lowStockItems: LowStockItem[] = (inventoryData ?? [])
        .filter(item => item.par_level && item.quantity < item.par_level)
        .map(item => ({
          store_id: item.store_id,
          store_name: item.store?.name ?? 'Unknown',
          inventory_item_id: item.inventory_item_id,
          item_name: item.inventory_item?.name ?? 'Unknown',
          current_quantity: item.quantity,
          par_level: item.par_level!,
          shortage: item.par_level! - item.quantity,
        }))
        .sort((a, b) => b.shortage - a.shortage)

      setData(lowStockItems)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch low stock report'))
    } finally {
      setIsLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    fetchLowStock()
  }, [fetchLowStock])

  return {
    data,
    isLoading,
    error,
    refetch: fetchLowStock,
  }
}

export function useDailyCounts(storeId?: string | null, date?: string) {
  const [data, setData] = useState<DailyCount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchDailyCounts = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const targetDate = date ?? new Date().toISOString().split('T')[0]

      const filter: Record<string, string> = { count_date: `eq.${targetDate}` }
      if (storeId) {
        filter['store_id'] = `eq.${storeId}`
      }

      const { data: countsData, error: fetchError } = await supabaseFetch<DailyCount>('daily_counts', {
        select: '*,store:stores!daily_counts_store_id_fkey(*),submitter:profiles!daily_counts_submitted_by_fkey(*)',
        filter,
      })

      if (fetchError) {
        // Table might not exist yet
        if (fetchError.message?.includes('does not exist')) {
          setData([])
          return
        }
        throw fetchError
      }

      setData(countsData || [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch daily counts'))
    } finally {
      setIsLoading(false)
    }
  }, [storeId, date])

  useEffect(() => {
    fetchDailyCounts()
  }, [fetchDailyCounts])

  return {
    data,
    isLoading,
    error,
    refetch: fetchDailyCounts,
  }
}

type MissingStore = { id: string; name: string }

export function useMissingCounts(storeId?: string | null, date?: string) {
  const [data, setData] = useState<MissingStore[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchMissingCounts = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const targetDate = date ?? new Date().toISOString().split('T')[0]

      // If storeId provided, only check that single store
      const storeFilter: Record<string, string> = { is_active: 'eq.true' }
      if (storeId) {
        storeFilter['id'] = `eq.${storeId}`
      }

      // Get active stores (scoped to storeId if provided)
      const { data: storesData, error: storesError } = await supabaseFetch<MissingStore>('stores', {
        select: 'id,name',
        filter: storeFilter,
      })

      if (storesError) throw storesError

      const stores = storesData ?? []

      // Get stores that have completed setup (have at least one inventory item)
      const invFilter: Record<string, string> = {}
      if (storeId) {
        invFilter['store_id'] = `eq.${storeId}`
      }

      const { data: inventoryData, error: invError } = await supabaseFetch<{ store_id: string }>('store_inventory', {
        select: 'store_id',
        filter: invFilter,
      })

      if (invError && !invError.message?.includes('does not exist')) {
        throw invError
      }

      // Build set of store IDs that have completed setup
      const setupCompleteStoreIds = new Set((inventoryData ?? []).map(i => i.store_id))

      // Filter to only stores that have completed setup
      const setupCompleteStores = stores.filter(store => setupCompleteStoreIds.has(store.id))

      // Get stores that submitted counts
      const countsFilter: Record<string, string> = { count_date: `eq.${targetDate}` }
      if (storeId) {
        countsFilter['store_id'] = `eq.${storeId}`
      }

      const { data: countsData, error: countsError } = await supabaseFetch<{ store_id: string }>('daily_counts', {
        select: 'store_id',
        filter: countsFilter,
      })

      // If daily_counts table doesn't exist, return all setup-complete stores as missing
      if (countsError) {
        if (countsError.message?.includes('does not exist')) {
          setData(setupCompleteStores)
          return
        }
        throw countsError
      }

      const counts = countsData ?? []
      const countedStoreIds = new Set(counts.map(c => c.store_id))

      // Filter stores that haven't submitted (only from setup-complete stores)
      setData(setupCompleteStores.filter(store => !countedStoreIds.has(store.id)))
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch missing counts'))
    } finally {
      setIsLoading(false)
    }
  }, [storeId, date])

  useEffect(() => {
    fetchMissingCounts()
  }, [fetchMissingCounts])

  return {
    data,
    isLoading,
    error,
    refetch: fetchMissingCounts,
  }
}
