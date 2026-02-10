'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabaseFetch, supabaseUpsert } from '@/lib/supabase/client'
import { StoreInventory, InventoryItem } from '@/types'
import { toast } from 'sonner'

export function useStoreInventory(storeId: string | null) {
  const [inventory, setInventory] = useState<StoreInventory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchInventory = useCallback(async () => {
    if (!storeId) {
      setInventory([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Fetch all active inventory items
      const { data: allItems, error: itemsError } = await supabaseFetch<InventoryItem>('inventory_items', {
        filter: { is_active: 'eq.true' },
        order: 'name',
      })

      if (itemsError) throw itemsError

      // Fetch existing store inventory records
      const { data: storeItems, error: storeError } = await supabaseFetch<StoreInventory>('store_inventory', {
        select: '*,inventory_item:inventory_items(*)',
        filter: { store_id: `eq.${storeId}` },
      })

      if (storeError) throw storeError

      // Create a map of existing store inventory by inventory_item_id
      const storeItemsMap = new Map<string, StoreInventory>()
      for (const item of storeItems || []) {
        storeItemsMap.set(item.inventory_item_id, item)
      }

      // Merge: include all inventory items, using store_inventory data if it exists
      const mergedInventory: StoreInventory[] = (allItems || []).map(item => {
        const existing = storeItemsMap.get(item.id)
        if (existing) return existing
        return {
          id: `virtual-${item.id}`,
          store_id: storeId,
          inventory_item_id: item.id,
          quantity: 0,
          par_level: null,
          unit_cost: 0,
          cost_currency: 'USD',
          last_updated_at: new Date().toISOString(),
          last_updated_by: null,
          inventory_item: item,
        }
      })

      setInventory(mergedInventory)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch inventory'))
    } finally {
      setIsLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  const updateQuantity = useCallback(async ({
    inventoryItemId,
    quantity,
    parLevel
  }: {
    inventoryItemId: string
    quantity: number
    parLevel?: number
  }) => {
    if (!storeId) throw new Error('No store selected')

    // Optimistic update
    setInventory(prev => prev.map(item =>
      item.inventory_item_id === inventoryItemId
        ? { ...item, quantity, ...(parLevel !== undefined && { par_level: parLevel }) }
        : item
    ))

    try {
      const { error } = await supabaseUpsert('store_inventory', {
        store_id: storeId,
        inventory_item_id: inventoryItemId,
        quantity,
        par_level: parLevel,
        last_updated_at: new Date().toISOString(),
      }, 'store_id,inventory_item_id')

      if (error) throw error
      toast.success('Stock updated')
    } catch (err) {
      fetchInventory()
      toast.error('Failed to update quantity: ' + (err instanceof Error ? err.message : 'Unknown error'))
      throw err
    }
  }, [storeId, fetchInventory])

  const setParLevel = useCallback(async ({
    inventoryItemId,
    parLevel
  }: {
    inventoryItemId: string
    parLevel: number
  }) => {
    if (!storeId) throw new Error('No store selected')

    // Optimistic update
    setInventory(prev => prev.map(item =>
      item.inventory_item_id === inventoryItemId
        ? { ...item, par_level: parLevel }
        : item
    ))

    try {
      const { error } = await supabaseUpsert('store_inventory', {
        store_id: storeId,
        inventory_item_id: inventoryItemId,
        par_level: parLevel,
        last_updated_at: new Date().toISOString(),
      }, 'store_id,inventory_item_id')

      if (error) throw error
      toast.success('PAR level updated')
    } catch (err) {
      fetchInventory()
      toast.error('Failed to update PAR level: ' + (err instanceof Error ? err.message : 'Unknown error'))
      throw err
    }
  }, [storeId, fetchInventory])

  // Get items below PAR level
  const lowStockItems = inventory.filter(
    item => item.par_level && item.quantity < item.par_level
  )

  return {
    inventory,
    lowStockItems,
    isLoading,
    error,
    updateQuantity,
    setParLevel,
    refetch: fetchInventory,
  }
}
