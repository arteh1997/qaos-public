'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabaseFetch, supabaseInsert, supabaseUpdate, supabaseDelete } from '@/lib/supabase/client'
import { Store } from '@/types'
import { StoreFormData } from '@/lib/validations/store'
import { sanitizeSearchInput, sanitizeErrorMessage } from '@/lib/utils'
import { toast } from 'sonner'

const PAGE_SIZE = 20

export interface StoresFilters {
  search?: string
  status?: 'active' | 'inactive' | 'all'
  page?: number
}

export interface PaginatedStores {
  stores: Store[]
  totalCount: number
  totalPages: number
  currentPage: number
}

export function useStores(filters: StoresFilters = {}) {
  const { search = '', status = 'all', page = 1 } = filters
  const [stores, setStores] = useState<Store[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchStores = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const filter: Record<string, string> = {}

      if (search) {
        const sanitizedSearch = sanitizeSearchInput(search)
        if (sanitizedSearch) {
          filter['or'] = `(name.ilike.%${sanitizedSearch}%,address.ilike.%${sanitizedSearch}%)`
        }
      }

      if (status === 'active') {
        filter['is_active'] = 'eq.true'
      } else if (status === 'inactive') {
        filter['is_active'] = 'eq.false'
      }

      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data, error: fetchError, count } = await supabaseFetch<Store>('stores', {
        order: 'name',
        filter,
        range: { from, to },
        count: true,
      })

      if (fetchError) throw fetchError

      setStores(data || [])
      setTotalCount(count ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch stores'))
    } finally {
      setIsLoading(false)
    }
  }, [search, status, page])

  useEffect(() => {
    fetchStores()
  }, [fetchStores])

  const createStore = useCallback(async (formData: StoreFormData) => {
    const now = new Date().toISOString()
    const optimisticStore: Store = {
      id: crypto.randomUUID(),
      name: formData.name,
      address: formData.address ?? null,
      is_active: true,
      opening_time: formData.opening_time ?? null,
      closing_time: formData.closing_time ?? null,
      weekly_hours: formData.weekly_hours ?? null,
      created_at: now,
      updated_at: now,
    }

    // Optimistic update
    setStores(prev => [...prev, optimisticStore].sort((a, b) => a.name.localeCompare(b.name)))
    setTotalCount(prev => prev + 1)

    try {
      const { error } = await supabaseInsert('stores', formData)

      if (error) throw error
      toast.success('Store created successfully')
      fetchStores()
    } catch (err) {
      // Rollback
      setStores(prev => prev.filter(s => s.id !== optimisticStore.id))
      setTotalCount(prev => prev - 1)
      toast.error('Failed to create store: ' + sanitizeErrorMessage(err))
      throw err
    }
  }, [fetchStores])

  const updateStore = useCallback(async ({ id, data }: { id: string; data: Partial<StoreFormData> }) => {
    // Optimistic update
    setStores(prev => prev.map(store =>
      store.id === id ? { ...store, ...data } : store
    ))

    try {
      const { error } = await supabaseUpdate('stores', id, data)

      if (error) throw error
      toast.success('Store updated successfully')
    } catch (err) {
      fetchStores()
      toast.error('Failed to update store: ' + sanitizeErrorMessage(err))
      throw err
    }
  }, [fetchStores])

  const deleteStore = useCallback(async (id: string) => {
    // Optimistic update
    setStores(prev => prev.filter(store => store.id !== id))
    setTotalCount(prev => prev - 1)

    try {
      const { error } = await supabaseDelete('stores', id)

      if (error) throw error
      toast.success('Store deleted successfully')
    } catch (err) {
      fetchStores()
      toast.error('Failed to delete store: ' + sanitizeErrorMessage(err))
      throw err
    }
  }, [fetchStores])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return {
    stores,
    totalCount,
    totalPages,
    currentPage: page,
    isLoading,
    error,
    createStore,
    updateStore,
    deleteStore,
    refetch: fetchStores,
  }
}
