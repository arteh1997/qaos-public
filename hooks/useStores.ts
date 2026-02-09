'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

/**
 * Fetch stores from API with filters
 * This function is used by the query and can be called directly for prefetching
 */
async function fetchStores(filters: StoresFilters = {}): Promise<PaginatedStores> {
  const { search = '', status = 'all', page = 1 } = filters

  // Build query params
  const params = new URLSearchParams()
  params.set('page', page.toString())
  params.set('page_size', PAGE_SIZE.toString())

  if (search) {
    const sanitizedSearch = sanitizeSearchInput(search)
    if (sanitizedSearch) {
      params.set('search', sanitizedSearch)
    }
  }

  if (status !== 'all') {
    params.set('status', status)
  }

  const response = await fetch(`/api/stores?${params.toString()}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch stores')
  }

  const data = await response.json()

  return {
    stores: data.data || [],
    totalCount: data.meta?.pagination?.total || 0,
    totalPages: Math.ceil((data.meta?.pagination?.total || 0) / PAGE_SIZE),
    currentPage: page,
  }
}

/**
 * TanStack Query hook for fetching stores with pagination and filters
 *
 * Replaces the old useStores hook with:
 * - Automatic request deduplication (no more race conditions)
 * - Built-in caching (30 second stale time)
 * - Background refetching on window focus
 * - Automatic retry on failure
 *
 * @example
 * const { data, isLoading, error } = useStoresQuery({ search: 'Restaurant', page: 1 })
 * console.log(data?.stores) // Store[]
 */
export function useStoresQuery(filters: StoresFilters = {}) {
  return useQuery({
    queryKey: ['stores', filters],
    queryFn: () => fetchStores(filters),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    // Placeholde data to prevent loading flicker on filter changes
    placeholderData: (previousData) => previousData,
  })
}

/**
 * Mutation hook for creating a new store
 *
 * Features:
 * - Optimistic updates (UI updates immediately)
 * - Automatic rollback on error
 * - Cache invalidation on success
 * - Toast notifications
 */
export function useCreateStore() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (formData: StoreFormData) => {
      const response = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create store')
      }

      return response.json()
    },
    // Optimistic update
    onMutate: async (formData) => {
      // Cancel outgoing queries to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['stores'] })

      // Snapshot previous value for rollback
      const previousStores = queryClient.getQueriesData({ queryKey: ['stores'] })

      // Optimistically update cache
      queryClient.setQueriesData<PaginatedStores>(
        { queryKey: ['stores'] },
        (old) => {
          if (!old) return old

          const optimisticStore: Store = {
            id: crypto.randomUUID(),
            name: formData.name,
            address: formData.address ?? null,
            is_active: true,
            opening_time: formData.opening_time ?? null,
            closing_time: formData.closing_time ?? null,
            weekly_hours: formData.weekly_hours ?? null,
            billing_user_id: formData.billing_user_id ?? null,
            subscription_status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          return {
            ...old,
            stores: [...old.stores, optimisticStore].sort((a, b) =>
              a.name.localeCompare(b.name)
            ),
            totalCount: old.totalCount + 1,
            totalPages: Math.ceil((old.totalCount + 1) / PAGE_SIZE),
          }
        }
      )

      return { previousStores }
    },
    // Rollback on error
    onError: (err, _formData, context) => {
      if (context?.previousStores) {
        // Restore previous cache state
        context.previousStores.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      toast.error('Failed to create store: ' + sanitizeErrorMessage(err))
    },
    // Refetch on success to get server-side data
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] })
      toast.success('Store created successfully')
    },
  })
}

/**
 * Mutation hook for updating a store
 */
export function useUpdateStore() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<StoreFormData> }) => {
      const response = await fetch(`/api/stores/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update store')
      }

      return response.json()
    },
    // Optimistic update
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['stores'] })
      const previousStores = queryClient.getQueriesData({ queryKey: ['stores'] })

      queryClient.setQueriesData<PaginatedStores>(
        { queryKey: ['stores'] },
        (old) => {
          if (!old) return old

          return {
            ...old,
            stores: old.stores.map((store) =>
              store.id === id ? { ...store, ...data } : store
            ),
          }
        }
      )

      return { previousStores }
    },
    onError: (err, _variables, context) => {
      if (context?.previousStores) {
        context.previousStores.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      toast.error('Failed to update store: ' + sanitizeErrorMessage(err))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] })
      toast.success('Store updated successfully')
    },
  })
}

/**
 * Mutation hook for deleting a store
 */
export function useDeleteStore() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/stores/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete store')
      }

      return response.json()
    },
    // Optimistic update
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['stores'] })
      const previousStores = queryClient.getQueriesData({ queryKey: ['stores'] })

      queryClient.setQueriesData<PaginatedStores>(
        { queryKey: ['stores'] },
        (old) => {
          if (!old) return old

          return {
            ...old,
            stores: old.stores.filter((store) => store.id !== id),
            totalCount: old.totalCount - 1,
            totalPages: Math.ceil((old.totalCount - 1) / PAGE_SIZE),
          }
        }
      )

      return { previousStores }
    },
    onError: (err, _id, context) => {
      if (context?.previousStores) {
        context.previousStores.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      toast.error('Failed to delete store: ' + sanitizeErrorMessage(err))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] })
      toast.success('Store deleted successfully')
    },
  })
}

/**
 * Combined hook that provides all store operations
 * This matches the API of the old useStores hook for easier migration
 *
 * @example
 * const { stores, isLoading, createStore, updateStore, deleteStore } = useStores({ page: 1 })
 */
export function useStores(filters: StoresFilters = {}) {
  const query = useStoresQuery(filters)
  const createMutation = useCreateStore()
  const updateMutation = useUpdateStore()
  const deleteMutation = useDeleteStore()

  return {
    // Query data
    stores: query.data?.stores || [],
    totalCount: query.data?.totalCount || 0,
    totalPages: query.data?.totalPages || 0,
    currentPage: filters.page || 1,
    isLoading: query.isLoading,
    error: query.error,

    // Mutations
    createStore: createMutation.mutate,
    updateStore: updateMutation.mutate,
    deleteStore: deleteMutation.mutate,

    // Additional mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,

    // Refetch function
    refetch: query.refetch,
  }
}
