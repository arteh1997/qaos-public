'use client'

import { useState, useCallback } from 'react'
import { getCSRFHeaders } from '@/hooks/useCSRF'
import { sanitizeErrorMessage } from '@/lib/utils'
import { toast } from 'sonner'

interface StockReceptionItem {
  inventory_item_id: string
  quantity: number
  total_cost?: number
}

interface StockReceptionData {
  store_id: string
  items: StockReceptionItem[]
  notes?: string
}

export function useStockReception() {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitReception = useCallback(async (data: StockReceptionData) => {
    setIsSubmitting(true)

    try {
      const validItems = data.items.filter(item => item.quantity > 0)

      if (validItems.length === 0) {
        return { success: true }
      }

      const response = await fetch(`/api/stores/${data.store_id}/stock-reception`, {
        method: 'POST',
        headers: getCSRFHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({
          items: validItems,
          notes: data.notes,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to record reception')
      }

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
