'use client'

import { useState, useCallback } from 'react'
import { getCSRFHeaders } from '@/hooks/useCSRF'
import { sanitizeErrorMessage } from '@/lib/utils'
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
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/stores/${data.store_id}/stock-count`, {
        method: 'POST',
        headers: getCSRFHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({
          items: data.items,
          notes: data.notes,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to submit stock count')
      }

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
