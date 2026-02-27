'use client'

import { useQuery } from '@tanstack/react-query'
import { supabaseFetch } from '@/lib/supabase/client'
import { StockHistory, LowStockItem, DailyCount } from '@/types'

export interface DateRange {
  from?: Date
  to?: Date
}

export function useStockHistory(storeId?: string | null, date?: string) {
  const query = useQuery({
    queryKey: ['stock-history', storeId, date],
    queryFn: async () => {
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

      const { data, error } = await supabaseFetch<StockHistory>('stock_history', {
        select: '*,inventory_item:inventory_items!stock_history_inventory_item_id_fkey(*),store:stores!stock_history_store_id_fkey(*),performer:profiles!stock_history_performed_by_fkey(*)',
        order: 'created_at.desc',
        filter,
      })

      if (error) {
        if (error.message?.includes('does not exist')) {
          return []
        }
        throw error
      }

      return data || []
    },
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  })

  return {
    data: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useStockHistoryRange(storeId?: string | null, dateRange?: DateRange) {
  const fromStr = dateRange?.from?.toISOString().split('T')[0]
  const toStr = dateRange?.to?.toISOString().split('T')[0]

  const query = useQuery({
    queryKey: ['stock-history-range', storeId, fromStr, toStr],
    queryFn: async () => {
      const filter: Record<string, string> = {}

      if (storeId) {
        filter['store_id'] = `eq.${storeId}`
      }

      if (fromStr) {
        filter['created_at'] = `gte.${fromStr}T00:00:00.000Z`
      }

      if (toStr) {
        filter['and'] = `(created_at.lte.${toStr}T23:59:59.999Z)`
      }

      const { data, error } = await supabaseFetch<StockHistory>('stock_history', {
        select: '*,inventory_item:inventory_items!stock_history_inventory_item_id_fkey(*),store:stores!stock_history_store_id_fkey(*),performer:profiles!stock_history_performed_by_fkey(*)',
        order: 'created_at.desc',
        filter,
        range: { from: 0, to: 499 },
      })

      if (error) {
        if (error.message?.includes('does not exist')) {
          return []
        }
        throw error
      }

      return data || []
    },
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  })

  return {
    data: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useLowStockReport(storeId?: string | null) {
  const query = useQuery({
    queryKey: ['low-stock-report', storeId],
    queryFn: async () => {
      const filter: Record<string, string> = { 'par_level': 'not.is.null' }
      if (storeId) {
        filter['store_id'] = `eq.${storeId}`
      }

      const { data, error } = await supabaseFetch<{
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

      if (error) throw error

      const lowStockItems: LowStockItem[] = (data ?? [])
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

      return lowStockItems
    },
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  })

  return {
    data: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useDailyCounts(storeId?: string | null, date?: string) {
  const query = useQuery({
    queryKey: ['daily-counts', storeId, date],
    queryFn: async () => {
      const targetDate = date ?? new Date().toISOString().split('T')[0]

      const filter: Record<string, string> = { count_date: `eq.${targetDate}` }
      if (storeId) {
        filter['store_id'] = `eq.${storeId}`
      }

      const { data, error } = await supabaseFetch<DailyCount>('daily_counts', {
        select: '*,store:stores!daily_counts_store_id_fkey(*),submitter:profiles!daily_counts_submitted_by_fkey(*)',
        filter,
      })

      if (error) {
        if (error.message?.includes('does not exist')) {
          return []
        }
        throw error
      }

      return data || []
    },
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  })

  return {
    data: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

type MissingStore = { id: string; name: string }

export function useMissingCounts(storeId?: string | null, date?: string) {
  const query = useQuery({
    queryKey: ['missing-counts', storeId, date],
    queryFn: async () => {
      const targetDate = date ?? new Date().toISOString().split('T')[0]

      const storeFilter: Record<string, string> = { is_active: 'eq.true' }
      if (storeId) {
        storeFilter['id'] = `eq.${storeId}`
      }

      const { data: storesData, error: storesError } = await supabaseFetch<MissingStore>('stores', {
        select: 'id,name',
        filter: storeFilter,
      })

      if (storesError) throw storesError

      const stores = storesData ?? []

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

      const setupCompleteStoreIds = new Set((inventoryData ?? []).map(i => i.store_id))
      const setupCompleteStores = stores.filter(store => setupCompleteStoreIds.has(store.id))

      const countsFilter: Record<string, string> = { count_date: `eq.${targetDate}` }
      if (storeId) {
        countsFilter['store_id'] = `eq.${storeId}`
      }

      const { data: countsData, error: countsError } = await supabaseFetch<{ store_id: string }>('daily_counts', {
        select: 'store_id',
        filter: countsFilter,
      })

      if (countsError) {
        if (countsError.message?.includes('does not exist')) {
          return setupCompleteStores
        }
        throw countsError
      }

      const counts = countsData ?? []
      const countedStoreIds = new Set(counts.map(c => c.store_id))

      return setupCompleteStores.filter(store => !countedStoreIds.has(store.id))
    },
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  })

  return {
    data: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
