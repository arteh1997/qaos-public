'use client'

import { useState, useCallback } from 'react'
import { createClient, supabaseFetch, supabaseUpsert, supabaseInsertMany } from '@/lib/supabase/client'
import { sanitizeNotes, sanitizeErrorMessage } from '@/lib/utils'
import { toast } from 'sonner'

interface StockReceptionItem {
  inventory_item_id: string
  quantity: number
}

interface StockReceptionData {
  store_id: string
  items: StockReceptionItem[]
  notes?: string
}

export function useStockReception() {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitReception = useCallback(async (data: StockReceptionData) => {
    // Use Supabase client only for auth
    const supabase = createClient()
    setIsSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Filter items with positive quantity
      const validItems = data.items.filter(item => item.quantity > 0)

      if (validItems.length === 0) {
        return { success: true } // Nothing to process
      }

      const now = new Date().toISOString()
      const sanitizedNotes = sanitizeNotes(data.notes)

      // BATCH OPERATION: Fetch all existing quantities in one query
      const itemIds = validItems.map(item => item.inventory_item_id)
      const { data: existingInventory } = await supabaseFetch<{
        inventory_item_id: string
        quantity: number
      }>('store_inventory', {
        select: 'inventory_item_id,quantity',
        filter: {
          store_id: `eq.${data.store_id}`,
          inventory_item_id: `in.(${itemIds.join(',')})`,
        },
      })

      // Create a map of existing quantities for quick lookup
      const existingQtyMap = new Map<string, number>()
      if (existingInventory) {
        for (const inv of existingInventory) {
          existingQtyMap.set(inv.inventory_item_id, inv.quantity)
        }
      }

      // Prepare batch updates with correct new quantities
      const inventoryUpdates = validItems.map(item => {
        const currentQty = existingQtyMap.get(item.inventory_item_id) || 0
        const newQty = currentQty + item.quantity
        return {
          store_id: data.store_id,
          inventory_item_id: item.inventory_item_id,
          quantity: newQty,
          last_updated_at: now,
          last_updated_by: user.id,
        }
      })

      // Prepare history records with accurate before/after quantities
      const historyInserts = validItems.map(item => {
        const currentQty = existingQtyMap.get(item.inventory_item_id) || 0
        return {
          store_id: data.store_id,
          inventory_item_id: item.inventory_item_id,
          action_type: 'Reception',
          quantity_before: currentQty,
          quantity_after: currentQty + item.quantity,
          quantity_change: item.quantity,
          performed_by: user.id,
          notes: sanitizedNotes,
        }
      })

      // BATCH OPERATION: Upsert all inventory updates at once
      const { error: upsertError } = await supabaseUpsert(
        'store_inventory',
        inventoryUpdates,
        'store_id,inventory_item_id'
      )

      if (upsertError) throw upsertError

      // BATCH OPERATION: Insert all stock history at once
      const { error: historyError } = await supabaseInsertMany('stock_history', historyInserts)

      if (historyError) throw historyError

      toast.success('Stock reception recorded successfully')
      return { success: true }
    } catch (err) {
      toast.error('Failed to record reception: ' + sanitizeErrorMessage(err))
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  return {
    submitReception,
    isSubmitting,
  }
}
