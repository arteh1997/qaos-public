import { useState, useCallback } from 'react'
import { useCSRF } from './useCSRF'
import type { PurchaseOrder } from '@/types'
import type {
  CreatePurchaseOrderFormData,
  UpdatePurchaseOrderFormData,
  ReceivePurchaseOrderFormData,
} from '@/lib/validations/suppliers'

interface UsePurchaseOrdersResult {
  orders: PurchaseOrder[]
  isLoading: boolean
  error: string | null
  fetchOrders: (options?: { status?: string; supplier_id?: string }) => Promise<void>
  createOrder: (data: CreatePurchaseOrderFormData) => Promise<PurchaseOrder>
  isSubmitting: boolean
}

export function usePurchaseOrders(storeId: string | null): UsePurchaseOrdersResult {
  const { csrfFetch } = useCSRF()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchOrders = useCallback(async (options?: { status?: string; supplier_id?: string }) => {
    if (!storeId) return

    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (options?.status) params.set('status', options.status)
      if (options?.supplier_id) params.set('supplier_id', options.supplier_id)

      const queryString = params.toString()
      const url = `/api/stores/${storeId}/purchase-orders${queryString ? `?${queryString}` : ''}`

      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) throw new Error(data.message || 'Failed to fetch purchase orders')

      setOrders(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch purchase orders')
    } finally {
      setIsLoading(false)
    }
  }, [storeId])

  const createOrder = useCallback(async (formData: CreatePurchaseOrderFormData): Promise<PurchaseOrder> => {
    if (!storeId) throw new Error('No store selected')

    try {
      setIsSubmitting(true)
      const response = await csrfFetch(`/api/stores/${storeId}/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to create purchase order')

      return data.data
    } finally {
      setIsSubmitting(false)
    }
  }, [storeId, csrfFetch])

  return {
    orders,
    isLoading,
    error,
    fetchOrders,
    createOrder,
    isSubmitting,
  }
}

// Hook for PO detail with items and status management
interface UsePurchaseOrderDetailResult {
  order: PurchaseOrder | null
  isLoading: boolean
  error: string | null
  fetchOrder: () => Promise<void>
  updateOrder: (data: UpdatePurchaseOrderFormData) => Promise<PurchaseOrder>
  receiveItems: (data: ReceivePurchaseOrderFormData) => Promise<void>
  deleteOrder: () => Promise<void>
  isSubmitting: boolean
}

export function usePurchaseOrderDetail(storeId: string | null, poId: string | null): UsePurchaseOrderDetailResult {
  const { csrfFetch } = useCSRF()
  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchOrder = useCallback(async () => {
    if (!storeId || !poId) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/stores/${storeId}/purchase-orders/${poId}`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.message || 'Failed to fetch purchase order')

      setOrder(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch purchase order')
    } finally {
      setIsLoading(false)
    }
  }, [storeId, poId])

  const updateOrder = useCallback(async (formData: UpdatePurchaseOrderFormData): Promise<PurchaseOrder> => {
    if (!storeId || !poId) throw new Error('Missing store or PO')

    try {
      setIsSubmitting(true)
      const response = await csrfFetch(`/api/stores/${storeId}/purchase-orders/${poId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to update purchase order')

      return data.data
    } finally {
      setIsSubmitting(false)
    }
  }, [storeId, poId, csrfFetch])

  const receiveItems = useCallback(async (formData: ReceivePurchaseOrderFormData): Promise<void> => {
    if (!storeId || !poId) throw new Error('Missing store or PO')

    try {
      setIsSubmitting(true)
      const response = await csrfFetch(`/api/stores/${storeId}/purchase-orders/${poId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to receive items')
    } finally {
      setIsSubmitting(false)
    }
  }, [storeId, poId, csrfFetch])

  const deleteOrder = useCallback(async (): Promise<void> => {
    if (!storeId || !poId) throw new Error('Missing store or PO')

    try {
      setIsSubmitting(true)
      const response = await csrfFetch(`/api/stores/${storeId}/purchase-orders/${poId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to delete purchase order')
    } finally {
      setIsSubmitting(false)
    }
  }, [storeId, poId, csrfFetch])

  return {
    order,
    isLoading,
    error,
    fetchOrder,
    updateOrder,
    receiveItems,
    deleteOrder,
    isSubmitting,
  }
}
