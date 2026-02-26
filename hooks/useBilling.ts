'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCSRFHeaders } from '@/hooks/useCSRF'
import { PaymentMethod, Invoice, Subscription } from '@/types/billing'
import { toast } from 'sonner'

interface SubscriptionWithStore extends Subscription {
  store: { id: string; name: string } | null
}

async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || `Failed to fetch ${url}`)
  }
  const data = await response.json()
  return data.data as T
}

export function useBilling() {
  const queryClient = useQueryClient()

  // ── Queries ──

  const subscriptionsQuery = useQuery({
    queryKey: ['billing', 'subscriptions'],
    queryFn: () => fetchJSON<SubscriptionWithStore[]>('/api/billing/subscriptions'),
    staleTime: 30_000,
  })

  const paymentMethodsQuery = useQuery({
    queryKey: ['billing', 'payment-methods'],
    queryFn: () => fetchJSON<PaymentMethod[]>('/api/billing/payment-methods'),
    staleTime: 30_000,
  })

  const invoicesQuery = useQuery({
    queryKey: ['billing', 'invoices'],
    queryFn: () => fetchJSON<Invoice[]>('/api/billing/invoices'),
    staleTime: 60_000,
  })

  // ── Payment Method Mutations ──

  const addPaymentMethod = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const response = await fetch('/api/billing/payment-methods', {
        method: 'POST',
        headers: getCSRFHeaders(),
        body: JSON.stringify({ paymentMethodId }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to add payment method')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'payment-methods'] })
      toast.success('Payment method added')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to add payment method')
    },
  })

  const removePaymentMethod = useMutation({
    mutationFn: async (pmId: string) => {
      const response = await fetch(`/api/billing/payment-methods/${pmId}`, {
        method: 'DELETE',
        headers: getCSRFHeaders(),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to remove payment method')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'payment-methods'] })
      toast.success('Payment method removed')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to remove payment method')
    },
  })

  const setDefaultPaymentMethod = useMutation({
    mutationFn: async (pmId: string) => {
      const response = await fetch(`/api/billing/payment-methods/${pmId}`, {
        method: 'PATCH',
        headers: getCSRFHeaders(),
        body: JSON.stringify({ action: 'set_default' }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to set default payment method')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'payment-methods'] })
      toast.success('Default payment method updated')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update default')
    },
  })

  // ── Subscription Mutations ──

  const cancelSubscription = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const response = await fetch(`/api/billing/subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        headers: getCSRFHeaders(),
        body: JSON.stringify({ action: 'cancel' }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to cancel subscription')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscriptions'] })
      toast.success('Subscription will be canceled at the end of the billing period')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel')
    },
  })

  const reactivateSubscription = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const response = await fetch(`/api/billing/subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        headers: getCSRFHeaders(),
        body: JSON.stringify({ action: 'reactivate' }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to reactivate subscription')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscriptions'] })
      toast.success('Subscription reactivated')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to reactivate')
    },
  })

  const isLoading = subscriptionsQuery.isLoading || paymentMethodsQuery.isLoading || invoicesQuery.isLoading

  const refreshSubscriptions = () => {
    queryClient.invalidateQueries({ queryKey: ['billing', 'subscriptions'] })
  }

  return {
    subscriptions: subscriptionsQuery.data || [],
    paymentMethods: paymentMethodsQuery.data || [],
    invoices: invoicesQuery.data || [],
    isLoading,
    error: subscriptionsQuery.error || paymentMethodsQuery.error || invoicesQuery.error,
    addPaymentMethod,
    removePaymentMethod,
    setDefaultPaymentMethod,
    cancelSubscription,
    reactivateSubscription,
    refreshSubscriptions,
  }
}
