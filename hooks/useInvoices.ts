'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCSRFHeaders } from '@/hooks/useCSRF'
import { InvoiceRecord, InvoiceLineItem } from '@/types'

interface InvoiceDetailRecord extends InvoiceRecord {
  file_url: string | null
  line_items: InvoiceLineItem[]
}
import { toast } from 'sonner'

interface InvoiceListParams {
  storeId: string | undefined
  status?: string
  supplierId?: string
  page?: number
  pageSize?: number
}

interface InvoiceListResponse {
  data: InvoiceRecord[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || `Failed to fetch ${url}`)
  }
  const json = await response.json()
  return json as T
}

export function useInvoices({ storeId, status, supplierId, page = 1, pageSize = 20 }: InvoiceListParams) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  if (status) params.set('status', status)
  if (supplierId) params.set('supplier_id', supplierId)

  const query = useQuery({
    queryKey: ['invoices', storeId, status, supplierId, page, pageSize],
    queryFn: () => fetchJSON<InvoiceListResponse>(`/api/stores/${storeId}/invoices?${params}`),
    enabled: !!storeId,
    staleTime: 15_000,
    gcTime: 5 * 60 * 1000,
  })

  return {
    invoices: query.data?.data || [],
    pagination: query.data?.pagination,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useInvoiceDetail(storeId: string | undefined, invoiceId: string | undefined) {
  const query = useQuery({
    queryKey: ['invoice', storeId, invoiceId],
    queryFn: () => fetchJSON<{ data: InvoiceDetailRecord }>(
      `/api/stores/${storeId}/invoices/${invoiceId}`
    ).then(res => res.data),
    enabled: !!storeId && !!invoiceId,
    staleTime: 10_000,
    gcTime: 5 * 60 * 1000,
  })

  return {
    invoice: query.data || null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useUploadInvoice(storeId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const csrfHeaders = getCSRFHeaders()
      // Remove Content-Type — fetch sets it automatically for FormData with boundary
      const headers: Record<string, string> = {}
      const csrfToken = csrfHeaders['x-csrf-token']
      if (csrfToken) headers['x-csrf-token'] = csrfToken

      const response = await fetch(`/api/stores/${storeId}/invoices`, {
        method: 'POST',
        headers,
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to upload invoice')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', storeId] })
      toast.success('Invoice uploaded — processing with OCR')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to upload invoice')
    },
  })
}

export function useUpdateInvoice(storeId: string | undefined, invoiceId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await fetch(`/api/stores/${storeId}/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: getCSRFHeaders(),
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const res = await response.json().catch(() => ({}))
        throw new Error(res.message || 'Failed to update invoice')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', storeId, invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoices', storeId] })
      toast.success('Invoice updated')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update invoice')
    },
  })
}

export function useApplyInvoice(storeId: string | undefined, invoiceId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (notes?: string) => {
      const response = await fetch(`/api/stores/${storeId}/invoices/${invoiceId}/apply`, {
        method: 'POST',
        headers: getCSRFHeaders(),
        body: JSON.stringify({ notes }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to apply invoice')
      }

      return response.json()
    },
    onSuccess: (data) => {
      const itemsUpdated = data?.data?.items_updated || 0
      queryClient.invalidateQueries({ queryKey: ['invoice', storeId, invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoices', storeId] })
      queryClient.invalidateQueries({ queryKey: ['store-inventory', storeId] })
      toast.success(`Invoice applied — ${itemsUpdated} item${itemsUpdated !== 1 ? 's' : ''} updated in inventory`)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to apply invoice')
    },
  })
}
