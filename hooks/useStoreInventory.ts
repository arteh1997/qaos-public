'use client'

import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { StoreInventory, InventoryItem } from '@/types'
import { toast } from 'sonner'
import { getCSRFHeaders } from '@/hooks/useCSRF'

/**
 * Fetch store inventory with joined inventory_item data
 * Now uses the NEW multi-tenant inventory_items with store_id
 */
async function fetchStoreInventory(storeId: string): Promise<StoreInventory[]> {
  if (!storeId) {
    return []
  }

  // Fetch inventory items and store_inventory records in parallel
  const [itemsResponse, storeInvResponse] = await Promise.all([
    fetch(`/api/inventory?store_id=${storeId}&pageSize=100`),
    fetch(`/api/stores/${storeId}/inventory?pageSize=100`),
  ])

  if (!itemsResponse.ok) {
    throw new Error(`Failed to fetch inventory items (${itemsResponse.status})`)
  }
  if (!storeInvResponse.ok) {
    throw new Error(`Failed to fetch store inventory (${storeInvResponse.status})`)
  }

  const [itemsData, storeInvData] = await Promise.all([
    itemsResponse.json(),
    storeInvResponse.json(),
  ])

  const items: InventoryItem[] = itemsData.data || []
  const storeInventoryRecords: StoreInventory[] = storeInvData.data || []

  // Create a map for quick lookup
  const storeInvMap = new Map<string, StoreInventory>()
  for (const record of storeInventoryRecords) {
    storeInvMap.set(record.inventory_item_id, record)
  }

  // Merge: all inventory items with their store_inventory data
  const merged: StoreInventory[] = items.map((item) => {
    const existing = storeInvMap.get(item.id)
    if (existing) {
      return { ...existing, inventory_item: item }
    }

    // Virtual record for items not yet in store_inventory
    return {
      id: `virtual-${item.id}`,
      store_id: storeId,
      inventory_item_id: item.id,
      quantity: 0,
      par_level: null,
      unit_cost: 0,
      cost_currency: 'GBP',
      last_updated_at: new Date().toISOString(),
      last_updated_by: null,
      inventory_item: item,
    }
  })

  return merged
}

/**
 * TanStack Query hook for store inventory
 *
 * Replaces the old useStoreInventory hook with:
 * - No more race conditions when switching stores
 * - Automatic caching per store
 * - Background refetching
 * - Request deduplication
 *
 * @example
 * const { data: inventory, isLoading } = useStoreInventoryQuery('store-id')
 */
export function useStoreInventoryQuery(storeId: string | null) {
  return useQuery({
    queryKey: ['store-inventory', storeId],
    queryFn: () => {
      if (!storeId) throw new Error('Store ID is required')
      return fetchStoreInventory(storeId)
    },
    enabled: !!storeId, // Only run if storeId is provided
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Creates optimistic mutation config for inventory updates.
 * Shared by useUpdateInventoryQuantity and useSetParLevel.
 */
function createOptimisticConfig<TVariables extends { inventoryItemId: string }>(
  storeId: string | null,
  queryClient: ReturnType<typeof useQueryClient>,
  transform: (item: StoreInventory, vars: TVariables) => StoreInventory,
  errorLabel: string,
  successLabel: string
) {
  return {
    onMutate: async (vars: TVariables) => {
      if (!storeId) return { previousInventory: undefined }
      await queryClient.cancelQueries({ queryKey: ['store-inventory', storeId] })
      const previousInventory = queryClient.getQueryData(['store-inventory', storeId])
      queryClient.setQueryData<StoreInventory[]>(
        ['store-inventory', storeId],
        (old) => old?.map((item) =>
          item.inventory_item_id === vars.inventoryItemId ? transform(item, vars) : item
        )
      )
      return { previousInventory }
    },
    onError: (err: Error, _vars: TVariables, context: { previousInventory?: unknown } | undefined) => {
      if (context?.previousInventory && storeId) {
        queryClient.setQueryData(['store-inventory', storeId], context.previousInventory)
      }
      toast.error(`${errorLabel}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    },
    onSuccess: () => {
      if (storeId) queryClient.invalidateQueries({ queryKey: ['store-inventory', storeId] })
      toast.success(successLabel)
    },
  }
}

/**
 * Mutation hook for updating inventory quantity and PAR level
 */
export function useUpdateInventoryQuantity(storeId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      inventoryItemId,
      quantity,
      parLevel,
    }: {
      inventoryItemId: string
      quantity: number
      parLevel?: number
    }) => {
      if (!storeId) throw new Error('Store ID is required')

      const response = await fetch(`/api/stores/${storeId}/inventory/${inventoryItemId}`, {
        method: 'PATCH',
        headers: getCSRFHeaders(),
        body: JSON.stringify({ quantity, par_level: parLevel }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to update inventory')
      }

      return response.json()
    },
    ...createOptimisticConfig(
      storeId, queryClient,
      (item, { quantity, parLevel }: { inventoryItemId: string; quantity: number; parLevel?: number }) => ({
        ...item, quantity,
        ...(parLevel !== undefined && { par_level: parLevel }),
        last_updated_at: new Date().toISOString(),
      }),
      'Failed to update quantity', 'Stock updated'
    ),
  })
}

/**
 * Mutation hook for updating PAR level only
 */
export function useSetParLevel(storeId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      inventoryItemId,
      parLevel,
    }: {
      inventoryItemId: string
      parLevel: number
    }) => {
      if (!storeId) throw new Error('Store ID is required')

      const response = await fetch(`/api/stores/${storeId}/inventory/${inventoryItemId}`, {
        method: 'PATCH',
        headers: getCSRFHeaders(),
        body: JSON.stringify({ par_level: parLevel }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to update PAR level')
      }

      return response.json()
    },
    ...createOptimisticConfig(
      storeId, queryClient,
      (item, { parLevel }: { inventoryItemId: string; parLevel: number }) => ({
        ...item, par_level: parLevel,
        last_updated_at: new Date().toISOString(),
      }),
      'Failed to update PAR level', 'PAR level updated'
    ),
  })
}

/**
 * Combined hook that matches the old useStoreInventory API
 *
 * @example
 * const { inventory, lowStockItems, updateQuantity, setParLevel, isLoading } = useStoreInventory('store-id')
 */
export function useStoreInventory(storeId: string | null) {
  const query = useStoreInventoryQuery(storeId)
  const updateQuantityMutation = useUpdateInventoryQuantity(storeId)
  const setParLevelMutation = useSetParLevel(storeId)

  const inventory = query.data || []

  const lowStockItems = useMemo(
    () => inventory.filter((item) => item.par_level && item.quantity < item.par_level),
    [inventory]
  )

  return {
    inventory,
    lowStockItems,
    isLoading: query.isLoading,
    error: query.error,
    updateQuantity: updateQuantityMutation.mutate,
    setParLevel: setParLevelMutation.mutate,
    refetch: query.refetch,
    isUpdating: updateQuantityMutation.isPending || setParLevelMutation.isPending,
  }
}
