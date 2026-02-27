'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCSRF } from './useCSRF'

export interface PosMenuItemRemote {
  pos_item_id: string
  pos_item_name: string
  price?: number
  currency?: string
  category?: string
  is_mapped: boolean
  mapping: {
    pos_item_id: string
    inventory_item_id: string
    is_active: boolean
  } | null
}

/**
 * Fetch POS menu items from the provider API via our backend.
 */
export function usePosMenuItems(storeId: string | null, connectionId: string | null) {
  return useQuery<PosMenuItemRemote[]>({
    queryKey: ['pos-menu-items', storeId, connectionId],
    queryFn: async () => {
      if (!storeId || !connectionId) return []
      const res = await fetch(
        `/api/stores/${storeId}/pos/menu-items?connection_id=${connectionId}`
      )
      if (!res.ok) throw new Error('Failed to fetch POS menu items')
      const json = await res.json()
      return json.data
    },
    enabled: !!storeId && !!connectionId,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  })
}

/**
 * Create or update an item mapping (POS item → inventory item).
 */
export function useCreatePosMapping(storeId: string | null) {
  const queryClient = useQueryClient()
  const { csrfFetch } = useCSRF()

  return useMutation({
    mutationFn: async (body: {
      pos_connection_id: string
      pos_item_id: string
      pos_item_name: string
      inventory_item_id: string
      quantity_per_sale?: number
    }) => {
      if (!storeId) throw new Error('Store ID is required')
      const res = await csrfFetch(`/api/stores/${storeId}/pos/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Failed to create mapping')
      }
      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pos-mappings', storeId, variables.pos_connection_id] })
      queryClient.invalidateQueries({ queryKey: ['pos-menu-items', storeId, variables.pos_connection_id] })
    },
  })
}

/**
 * Delete an item mapping.
 */
export function useDeletePosMapping(storeId: string | null) {
  const queryClient = useQueryClient()
  const { csrfFetch } = useCSRF()

  return useMutation({
    mutationFn: async (mappingId: string) => {
      if (!storeId) throw new Error('Store ID is required')
      const res = await csrfFetch(`/api/stores/${storeId}/pos/mappings?mappingId=${mappingId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Failed to delete mapping')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-mappings', storeId] })
      queryClient.invalidateQueries({ queryKey: ['pos-menu-items', storeId] })
    },
  })
}
