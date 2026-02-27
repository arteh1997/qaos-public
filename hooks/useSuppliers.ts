import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCSRFHeaders } from '@/hooks/useCSRF'
import type { Supplier, SupplierItem } from '@/types'
import type { CreateSupplierFormData, SupplierItemFormData } from '@/lib/validations/suppliers'

interface UseSupplierResult {
  suppliers: Supplier[]
  isLoading: boolean
  error: string | null
  fetchSuppliers: (options?: { active?: boolean; search?: string }) => Promise<void>
  createSupplier: (data: CreateSupplierFormData) => Promise<Supplier>
  updateSupplier: (supplierId: string, data: Partial<CreateSupplierFormData>) => Promise<Supplier>
  deleteSupplier: (supplierId: string) => Promise<void>
  isSubmitting: boolean
}

export function useSuppliers(storeId: string | null): UseSupplierResult {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['suppliers', storeId],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/suppliers`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.message || 'Failed to fetch suppliers')

      return (data.data || []) as Supplier[]
    },
    enabled: !!storeId,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: async (formData: CreateSupplierFormData): Promise<Supplier> => {
      if (!storeId) throw new Error('No store selected')

      const response = await fetch(`/api/stores/${storeId}/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeaders() },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to create supplier')

      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', storeId] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ supplierId, formData }: { supplierId: string; formData: Partial<CreateSupplierFormData> }): Promise<Supplier> => {
      if (!storeId) throw new Error('No store selected')

      const response = await fetch(`/api/stores/${storeId}/suppliers/${supplierId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeaders() },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to update supplier')

      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', storeId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (supplierId: string): Promise<void> => {
      if (!storeId) throw new Error('No store selected')

      const response = await fetch(`/api/stores/${storeId}/suppliers/${supplierId}`, {
        method: 'DELETE',
        headers: getCSRFHeaders(),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to delete supplier')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', storeId] })
    },
  })

  // Backward-compatible fetchSuppliers — refetches data, filter options applied via query params
  const fetchSuppliers = async (options?: { active?: boolean; search?: string }) => {
    if (options) {
      // If caller passes filters, do a direct fetch and update cache
      if (!storeId) return
      const params = new URLSearchParams()
      if (options.active !== undefined) params.set('active', String(options.active))
      if (options.search) params.set('search', options.search)
      const queryString = params.toString()
      const url = `/api/stores/${storeId}/suppliers${queryString ? `?${queryString}` : ''}`
      const response = await fetch(url)
      const data = await response.json()
      if (response.ok) {
        queryClient.setQueryData(['suppliers', storeId], data.data || [])
      }
    } else {
      await query.refetch()
    }
  }

  return {
    suppliers: query.data || [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    fetchSuppliers,
    createSupplier: createMutation.mutateAsync,
    updateSupplier: (supplierId: string, data: Partial<CreateSupplierFormData>) =>
      updateMutation.mutateAsync({ supplierId, formData: data }),
    deleteSupplier: deleteMutation.mutateAsync,
    isSubmitting: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  }
}

// Hook for supplier items management
interface UseSupplierItemsResult {
  items: SupplierItem[]
  isLoading: boolean
  error: string | null
  fetchItems: () => Promise<void>
  addItem: (data: SupplierItemFormData) => Promise<SupplierItem>
  removeItem: (itemId: string) => Promise<void>
  isSubmitting: boolean
}

export function useSupplierItems(storeId: string | null, supplierId: string | null): UseSupplierItemsResult {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['supplier-items', storeId, supplierId],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/suppliers/${supplierId}/items`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.message || 'Failed to fetch supplier items')

      return (data.data || []) as SupplierItem[]
    },
    enabled: !!storeId && !!supplierId,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  })

  const addMutation = useMutation({
    mutationFn: async (formData: SupplierItemFormData): Promise<SupplierItem> => {
      if (!storeId || !supplierId) throw new Error('Missing store or supplier')

      const response = await fetch(`/api/stores/${storeId}/suppliers/${supplierId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeaders() },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to add supplier item')

      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-items', storeId, supplierId] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (itemId: string): Promise<void> => {
      if (!storeId || !supplierId) throw new Error('Missing store or supplier')

      const response = await fetch(
        `/api/stores/${storeId}/suppliers/${supplierId}/items?itemId=${itemId}`,
        { method: 'DELETE', headers: getCSRFHeaders() }
      )

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to remove supplier item')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-items', storeId, supplierId] })
    },
  })

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    fetchItems: async () => { await query.refetch() },
    addItem: addMutation.mutateAsync,
    removeItem: removeMutation.mutateAsync,
    isSubmitting: addMutation.isPending || removeMutation.isPending,
  }
}
