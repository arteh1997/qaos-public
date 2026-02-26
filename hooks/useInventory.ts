'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabaseFetch } from '@/lib/supabase/client'
import { getCSRFHeaders } from '@/hooks/useCSRF'
import { useAuth } from '@/components/providers/AuthProvider'
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
  const { storeId } = useAuth()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchInventory = useCallback(async () => {
    if (!storeId) {
      setItems([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabaseFetch<InventoryItem>('inventory_items', {
        order: 'name',
        filter: { is_active: 'eq.true', store_id: `eq.${storeId}` },
      })

      if (fetchError) throw fetchError
      setItems(data || [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch inventory'))
    } finally {
      setIsLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  const createItem = useCallback(async (formData: CreateInventoryItemData): Promise<InventoryItem | null> => {
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

    setItems(prev => [...prev, optimisticItem].sort((a, b) => a.name.localeCompare(b.name)))

    try {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: getCSRFHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({
          store_id: storeId,
          name: formData.name,
          category: formData.category ?? null,
          unit_of_measure: formData.unit_of_measure,
          is_active: formData.is_active ?? true,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to create item')
      }

      const json = await response.json()
      toast.success('Inventory item created successfully')
      fetchInventory()
      return json.data as InventoryItem
    } catch (err) {
      setItems(prev => prev.filter(item => item.id !== optimisticItem.id))
      toast.error('Failed to create item: ' + sanitizeErrorMessage(err))
      throw err
    }
  }, [fetchInventory, storeId])

  const updateItem = useCallback(async ({ id, data }: { id: string; data: UpdateInventoryItemData }) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...data } : item
    ))

    try {
      const response = await fetch(`/api/inventory/${id}`, {
        method: 'PATCH',
        headers: getCSRFHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to update item')
      }

      toast.success('Inventory item updated successfully')
    } catch (err) {
      fetchInventory()
      toast.error('Failed to update item: ' + sanitizeErrorMessage(err))
      throw err
    }
  }, [fetchInventory])

  const deleteItem = useCallback(async (id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, is_active: false } : item
    ))

    try {
      const response = await fetch(`/api/inventory/${id}`, {
        method: 'DELETE',
        headers: getCSRFHeaders(),
        credentials: 'same-origin',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to delete item')
      }
    } catch (err) {
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
