'use client'

import { useState, useCallback } from 'react'

const PORTAL_TOKEN_KEY = 'supplier_portal_token'

/**
 * Hook for supplier portal authentication and data fetching.
 * Stores token in localStorage — the portal has no user session.
 */
export function usePortalAuth() {
  const [token, setTokenState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(PORTAL_TOKEN_KEY)
  })

  const setToken = useCallback((newToken: string) => {
    localStorage.setItem(PORTAL_TOKEN_KEY, newToken)
    setTokenState(newToken)
  }, [])

  const clearToken = useCallback(() => {
    localStorage.removeItem(PORTAL_TOKEN_KEY)
    setTokenState(null)
  }, [])

  return { token, setToken, clearToken, isAuthenticated: !!token }
}

/**
 * Authenticated fetch for portal API calls.
 */
export function usePortalFetch() {
  const { token, clearToken } = usePortalAuth()

  const portalFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      if (!token) throw new Error('Not authenticated')

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        ...((options.headers as Record<string, string>) || {}),
      }

      // Only add Content-Type for JSON bodies (not FormData)
      if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json'
      }

      const res = await fetch(`/api/supplier-portal${path}`, {
        ...options,
        headers,
      })

      if (res.status === 401) {
        clearToken()
        throw new Error('Session expired')
      }

      return res.json()
    },
    [token, clearToken]
  )

  return { portalFetch }
}

/**
 * Hook to fetch portal orders.
 */
export function usePortalOrders() {
  const { portalFetch } = usePortalFetch()
  const [orders, setOrders] = useState<Record<string, unknown>[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 })

  const fetchOrders = useCallback(
    async (opts?: { status?: string; page?: number }) => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        if (opts?.status) params.set('status', opts.status)
        if (opts?.page) params.set('page', String(opts.page))
        const query = params.toString() ? `?${params.toString()}` : ''
        const res = await portalFetch(`/orders${query}`)
        if (res.success) {
          setOrders(res.data)
          if (res.pagination) setPagination(res.pagination)
        }
      } finally {
        setIsLoading(false)
      }
    },
    [portalFetch]
  )

  return { orders, isLoading, pagination, fetchOrders }
}

/**
 * Hook to fetch a single order detail.
 */
export function usePortalOrderDetail() {
  const { portalFetch } = usePortalFetch()
  const [order, setOrder] = useState<Record<string, unknown> | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchOrder = useCallback(
    async (poId: string) => {
      setIsLoading(true)
      try {
        const res = await portalFetch(`/orders/${poId}`)
        if (res.success) setOrder(res.data)
      } finally {
        setIsLoading(false)
      }
    },
    [portalFetch]
  )

  const updateStatus = useCallback(
    async (poId: string, data: { status: string; notes?: string }) => {
      const res = await portalFetch(`/orders/${poId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
      return res
    },
    [portalFetch]
  )

  return { order, isLoading, fetchOrder, updateStatus }
}

/**
 * Hook for catalog management.
 */
export function usePortalCatalog() {
  const { portalFetch } = usePortalFetch()
  const [items, setItems] = useState<Record<string, unknown>[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchCatalog = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await portalFetch('/catalog')
      if (res.success) setItems(res.data)
    } finally {
      setIsLoading(false)
    }
  }, [portalFetch])

  const updateCatalog = useCallback(
    async (updates: Array<{ id: string; unit_cost?: number; lead_time_days?: number; min_order_quantity?: number }>) => {
      const res = await portalFetch('/catalog', {
        method: 'PUT',
        body: JSON.stringify({ items: updates }),
      })
      return res
    },
    [portalFetch]
  )

  return { items, isLoading, fetchCatalog, updateCatalog }
}
