'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabaseFetch, supabaseInsert, supabaseUpdate, supabaseDelete } from '@/lib/supabase/client'
import { InventoryItem } from '@/types'
import { sanitizeErrorMessage } from '@/lib/utils'
import { toast } from 'sonner'

export interface CreateInventoryItemData {
  name: string
  category?: string | null
  unit_of_measure: string
  is_active?: boolean
}

export interface UpdateInventoryItemData {
  name?: string
  category?: string | null
  unit_of_measure?: string
  is_active?: boolean
}

export function useInventory() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchInventory = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabaseFetch<InventoryItem>('inventory_items', {
        order: 'name',
      })

      if (fetchError) throw fetchError
      setItems(data || [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch inventory'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  const createItem = useCallback(async (formData: CreateInventoryItemData) => {
    const now = new Date().toISOString()
    const optimisticItem: InventoryItem = {
      id: crypto.randomUUID(),
      store_id: '',
      name: formData.name,
      category: formData.category ?? null,
      category_id: null,
      unit_of_measure: formData.unit_of_measure,
      is_active: formData.is_active ?? true,
      created_at: now,
      updated_at: now,
    }

    // Optimistic update
    setItems(prev => [...prev, optimisticItem].sort((a, b) => a.name.localeCompare(b.name)))

    try {
      const { error } = await supabaseInsert('inventory_items', {
        name: formData.name,
        category: formData.category ?? null,
        unit_of_measure: formData.unit_of_measure,
        is_active: formData.is_active ?? true,
      })

      if (error) throw error
      toast.success('Inventory item created successfully')
      fetchInventory()
    } catch (err) {
      // Rollback optimistic update
      setItems(prev => prev.filter(item => item.id !== optimisticItem.id))
      toast.error('Failed to create item: ' + sanitizeErrorMessage(err))
      throw err
    }
  }, [fetchInventory])

  const updateItem = useCallback(async ({ id, data }: { id: string; data: UpdateInventoryItemData }) => {
    // Optimistic update
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...data } : item
    ))

    try {
      const { error } = await supabaseUpdate('inventory_items', id, data as Record<string, unknown>)

      if (error) throw error
      toast.success('Inventory item updated successfully')
    } catch (err) {
      // Refetch to restore correct state
      fetchInventory()
      toast.error('Failed to update item: ' + sanitizeErrorMessage(err))
      throw err
    }
  }, [fetchInventory])

  const deleteItem = useCallback(async (id: string) => {
    // Optimistic update - remove from list
    setItems(prev => prev.filter(item => item.id !== id))

    try {
      const { error } = await supabaseDelete('inventory_items', id)

      if (error) throw error
      toast.success('Inventory item deleted')
    } catch (err) {
      // Refetch to restore correct state
      fetchInventory()
      toast.error('Failed to delete item: ' + sanitizeErrorMessage(err))
      throw err
    }
  }, [fetchInventory])

  return {
    items,
    activeItems: items.filter(item => item.is_active),
    isLoading,
    error,
    createItem,
    updateItem,
    deleteItem,
    refetch: fetchInventory,
  }
}
