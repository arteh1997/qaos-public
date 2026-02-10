'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useCSRF } from './useCSRF'

export interface PosConnection {
  id: string
  provider: string
  name: string
  is_active: boolean
  last_synced_at: string | null
  sync_status: string
  sync_error: string | null
  created_at: string
}

export interface PosItemMapping {
  id: string
  pos_item_id: string
  pos_item_name: string
  quantity_per_sale: number
  is_active: boolean
  created_at: string
  inventory_item: {
    id: string
    name: string
    category: string | null
    unit_of_measure: string
  } | null
}

export interface PosSaleEvent {
  id: string
  external_event_id: string
  event_type: string
  items: unknown
  total_amount: number | null
  currency: string | null
  occurred_at: string
  processed_at: string | null
  status: string
  error_message: string | null
  created_at: string
}

export function usePosConnections(storeId: string | null) {
  const fetchConnections = useCallback(async (): Promise<PosConnection[]> => {
    if (!storeId) return []
    const response = await fetch(`/api/stores/${storeId}/pos`)
    if (!response.ok) throw new Error('Failed to fetch POS connections')
    const json = await response.json()
    return json.data
  }, [storeId])

  return useQuery<PosConnection[]>({
    queryKey: ['pos-connections', storeId],
    queryFn: fetchConnections,
    enabled: !!storeId,
  })
}

export function useCreatePosConnection(storeId: string | null) {
  const queryClient = useQueryClient()
  const { csrfFetch } = useCSRF()

  return useMutation({
    mutationFn: async (body: { provider: string; name: string; credentials?: Record<string, unknown>; config?: Record<string, unknown> }) => {
      if (!storeId) throw new Error('Store ID is required')
      const response = await csrfFetch(`/api/stores/${storeId}/pos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.message || 'Failed to create POS connection')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-connections', storeId] })
    },
  })
}

export function usePosItemMappings(storeId: string | null, connectionId: string | null) {
  const fetchMappings = useCallback(async (): Promise<PosItemMapping[]> => {
    if (!storeId || !connectionId) return []
    const response = await fetch(`/api/stores/${storeId}/pos/mappings?connectionId=${connectionId}`)
    if (!response.ok) throw new Error('Failed to fetch POS item mappings')
    const json = await response.json()
    return json.data
  }, [storeId, connectionId])

  return useQuery<PosItemMapping[]>({
    queryKey: ['pos-mappings', storeId, connectionId],
    queryFn: fetchMappings,
    enabled: !!storeId && !!connectionId,
  })
}

export function usePosSaleEvents(storeId: string | null, connectionId?: string | null) {
  const fetchEvents = useCallback(async (): Promise<PosSaleEvent[]> => {
    if (!storeId) return []
    let url = `/api/stores/${storeId}/pos/events`
    if (connectionId) url += `?connectionId=${connectionId}`
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch POS sale events')
    const json = await response.json()
    return json.data
  }, [storeId, connectionId])

  return useQuery<PosSaleEvent[]>({
    queryKey: ['pos-events', storeId, connectionId],
    queryFn: fetchEvents,
    enabled: !!storeId,
  })
}
