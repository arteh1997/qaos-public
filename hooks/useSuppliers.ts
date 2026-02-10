import { useState, useCallback } from 'react'
import { useCSRF } from './useCSRF'
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
  const { csrfFetch } = useCSRF()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchSuppliers = useCallback(async (options?: { active?: boolean; search?: string }) => {
    if (!storeId) return

    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (options?.active !== undefined) params.set('active', String(options.active))
      if (options?.search) params.set('search', options.search)

      const queryString = params.toString()
      const url = `/api/stores/${storeId}/suppliers${queryString ? `?${queryString}` : ''}`

      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) throw new Error(data.message || 'Failed to fetch suppliers')

      setSuppliers(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch suppliers')
    } finally {
      setIsLoading(false)
    }
  }, [storeId])

  const createSupplier = useCallback(async (formData: CreateSupplierFormData): Promise<Supplier> => {
    if (!storeId) throw new Error('No store selected')

    try {
      setIsSubmitting(true)
      const response = await csrfFetch(`/api/stores/${storeId}/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to create supplier')

      return data.data
    } finally {
      setIsSubmitting(false)
    }
  }, [storeId, csrfFetch])

  const updateSupplier = useCallback(async (supplierId: string, formData: Partial<CreateSupplierFormData>): Promise<Supplier> => {
    if (!storeId) throw new Error('No store selected')

    try {
      setIsSubmitting(true)
      const response = await csrfFetch(`/api/stores/${storeId}/suppliers/${supplierId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to update supplier')

      return data.data
    } finally {
      setIsSubmitting(false)
    }
  }, [storeId, csrfFetch])

  const deleteSupplier = useCallback(async (supplierId: string): Promise<void> => {
    if (!storeId) throw new Error('No store selected')

    try {
      setIsSubmitting(true)
      const response = await csrfFetch(`/api/stores/${storeId}/suppliers/${supplierId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to delete supplier')
    } finally {
      setIsSubmitting(false)
    }
  }, [storeId, csrfFetch])

  return {
    suppliers,
    isLoading,
    error,
    fetchSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    isSubmitting,
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
  const { csrfFetch } = useCSRF()
  const [items, setItems] = useState<SupplierItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchItems = useCallback(async () => {
    if (!storeId || !supplierId) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/stores/${storeId}/suppliers/${supplierId}/items`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.message || 'Failed to fetch supplier items')

      setItems(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch supplier items')
    } finally {
      setIsLoading(false)
    }
  }, [storeId, supplierId])

  const addItem = useCallback(async (formData: SupplierItemFormData): Promise<SupplierItem> => {
    if (!storeId || !supplierId) throw new Error('Missing store or supplier')

    try {
      setIsSubmitting(true)
      const response = await csrfFetch(`/api/stores/${storeId}/suppliers/${supplierId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to add supplier item')

      return data.data
    } finally {
      setIsSubmitting(false)
    }
  }, [storeId, supplierId, csrfFetch])

  const removeItem = useCallback(async (itemId: string): Promise<void> => {
    if (!storeId || !supplierId) throw new Error('Missing store or supplier')

    try {
      setIsSubmitting(true)
      const response = await csrfFetch(
        `/api/stores/${storeId}/suppliers/${supplierId}/items?itemId=${itemId}`,
        { method: 'DELETE' }
      )

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to remove supplier item')
    } finally {
      setIsSubmitting(false)
    }
  }, [storeId, supplierId, csrfFetch])

  return {
    items,
    isLoading,
    error,
    fetchItems,
    addItem,
    removeItem,
    isSubmitting,
  }
}
