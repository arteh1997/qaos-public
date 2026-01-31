'use client'

import { useState, useCallback } from 'react'
import { createClient, supabaseFetch, supabaseUpsert, supabaseInsertMany } from '@/lib/supabase/client'
import { sanitizeNotes, sanitizeErrorMessage } from '@/lib/utils'
import { toast } from 'sonner'

interface StockCountItem {
  inventory_item_id: string
  quantity: number
}

interface StockCountData {
  store_id: string
  items: StockCountItem[]
  notes?: string
}

export function useStockCount() {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitCount = useCallback(async (data: StockCountData) => {
    // Use Supabase client only for auth
    const supabase = createClient()
    setIsSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const now = new Date().toISOString()
      const today = new Date().toISOString().split('T')[0]
      const sanitizedNotes = sanitizeNotes(data.notes)

      // BATCH OPERATION: Fetch all existing quantities in one query for accurate history
      const itemIds = data.items.map(item => item.inventory_item_id)
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

      // Prepare inventory updates
      const inventoryUpdates = data.items.map(item => ({
        store_id: data.store_id,
        inventory_item_id: item.inventory_item_id,
        quantity: item.quantity,
        last_updated_at: now,
        last_updated_by: user.id,
      }))

      // Prepare history with accurate before quantities
      const historyInserts = data.items.map(item => {
        const previousQty = existingQtyMap.get(item.inventory_item_id) || 0
        return {
          store_id: data.store_id,
          inventory_item_id: item.inventory_item_id,
          action_type: 'Count',
          quantity_before: previousQty,
          quantity_after: item.quantity,
          quantity_change: item.quantity - previousQty,
          performed_by: user.id,
          notes: sanitizedNotes,
        }
      })

      // BATCH OPERATION: Upsert store inventory
      const { error: inventoryError } = await supabaseUpsert(
        'store_inventory',
        inventoryUpdates,
        'store_id,inventory_item_id'
      )

      if (inventoryError) throw inventoryError

      // BATCH OPERATION: Insert stock history
      const { error: historyError } = await supabaseInsertMany('stock_history', historyInserts)

      if (historyError) throw historyError

      // Mark daily count as complete
      const { error: dailyError } = await supabaseUpsert('daily_counts', {
        store_id: data.store_id,
        count_date: today,
        submitted_by: user.id,
        submitted_at: now,
      }, 'store_id,count_date')

      if (dailyError) throw dailyError

      toast.success('Stock count submitted successfully')
      return { success: true }
    } catch (err) {
      toast.error('Failed to submit stock count: ' + sanitizeErrorMessage(err))
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  return {
    submitCount,
    isSubmitting,
  }
}
