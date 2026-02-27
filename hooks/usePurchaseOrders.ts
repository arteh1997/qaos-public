import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCSRFHeaders } from '@/hooks/useCSRF'
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
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['purchase-orders', storeId],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/purchase-orders`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.message || 'Failed to fetch purchase orders')

      return (data.data || []) as PurchaseOrder[]
    },
    enabled: !!storeId,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: async (formData: CreatePurchaseOrderFormData): Promise<PurchaseOrder> => {
      if (!storeId) throw new Error('No store selected')

      const response = await fetch(`/api/stores/${storeId}/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeaders() },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to create purchase order')

      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', storeId] })
    },
  })

  // Backward-compatible fetchOrders with filter options
  const fetchOrders = async (options?: { status?: string; supplier_id?: string }) => {
    if (options && Object.keys(options).length > 0) {
      if (!storeId) return
      const params = new URLSearchParams()
      if (options.status) params.set('status', options.status)
      if (options.supplier_id) params.set('supplier_id', options.supplier_id)
      const queryString = params.toString()
      const url = `/api/stores/${storeId}/purchase-orders${queryString ? `?${queryString}` : ''}`
      const response = await fetch(url)
      const data = await response.json()
      if (response.ok) {
        queryClient.setQueryData(['purchase-orders', storeId], data.data || [])
      }
    } else {
      await query.refetch()
    }
  }

  return {
    orders: query.data || [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    fetchOrders,
    createOrder: createMutation.mutateAsync,
    isSubmitting: createMutation.isPending,
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
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['purchase-order-detail', storeId, poId],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/purchase-orders/${poId}`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.message || 'Failed to fetch purchase order')

      return data.data as PurchaseOrder
    },
    enabled: !!storeId && !!poId,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  })

  const updateMutation = useMutation({
    mutationFn: async (formData: UpdatePurchaseOrderFormData): Promise<PurchaseOrder> => {
      if (!storeId || !poId) throw new Error('Missing store or PO')

      const response = await fetch(`/api/stores/${storeId}/purchase-orders/${poId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeaders() },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to update purchase order')

      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order-detail', storeId, poId] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', storeId] })
    },
  })

  const receiveMutation = useMutation({
    mutationFn: async (formData: ReceivePurchaseOrderFormData): Promise<void> => {
      if (!storeId || !poId) throw new Error('Missing store or PO')

      const response = await fetch(`/api/stores/${storeId}/purchase-orders/${poId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeaders() },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to receive items')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order-detail', storeId, poId] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', storeId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!storeId || !poId) throw new Error('Missing store or PO')

      const response = await fetch(`/api/stores/${storeId}/purchase-orders/${poId}`, {
        method: 'DELETE',
        headers: getCSRFHeaders(),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to delete purchase order')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', storeId] })
    },
  })

  return {
    order: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    fetchOrder: async () => { await query.refetch() },
    updateOrder: updateMutation.mutateAsync,
    receiveItems: receiveMutation.mutateAsync,
    deleteOrder: deleteMutation.mutateAsync,
    isSubmitting: updateMutation.isPending || receiveMutation.isPending || deleteMutation.isPending,
  }
}
