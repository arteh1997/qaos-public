'use client'

/**
 * useSubscriptionGuard Hook
 *
 * Checks if a store has an active subscription and handles redirects
 * for expired subscriptions.
 *
 * Active statuses: 'trialing', 'active', 'past_due' (grace period)
 * Expired statuses: 'canceled', 'unpaid', null (no subscription)
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { SubscriptionStatus } from '@/types'

interface SubscriptionGuardResult {
  isLoading: boolean
  isActive: boolean
  status: SubscriptionStatus | null
  storeName: string | null
}

// Subscription statuses that allow access to the store
const ACTIVE_STATUSES: SubscriptionStatus[] = ['trialing', 'active', 'past_due']

export function useSubscriptionGuard(storeId: string | null): SubscriptionGuardResult {
  const router = useRouter()
  const { stores, isLoading: authLoading, role } = useAuth()
  const [hasChecked, setHasChecked] = useState(false)

  // Skip check if no storeId provided (e.g., on subscription-expired page)
  const skipCheck = !storeId

  // Find the store in user's memberships
  const storeUser = skipCheck ? null : stores?.find(s => s.store_id === storeId)
  const store = storeUser?.store
  const status = (store?.subscription_status as SubscriptionStatus) || null
  const isActive = skipCheck || (status !== null && ACTIVE_STATUSES.includes(status))

  useEffect(() => {
    // Skip if no storeId provided
    if (skipCheck) {
      setHasChecked(true)
      return
    }

    // Wait for auth to load
    if (authLoading) return

    // Mark as checked once auth is loaded
    setHasChecked(true)

    // If no store found in user's memberships, let the page handle 404
    if (!storeUser) return

    // Only Owners need active subscriptions - other roles can access if Owner pays
    // However, all roles should be blocked if subscription is expired
    if (!isActive && status !== null) {
      // Subscription expired - redirect to subscription-expired page
      router.replace(`/stores/${storeId}/subscription-expired`)
    } else if (!isActive && status === null && role === 'Owner') {
      // No subscription at all (Owner creating store) - redirect to subscribe
      // Note: This case should ideally be handled at store creation
      router.replace(`/billing/subscribe/${storeId}`)
    }
  }, [authLoading, storeUser, isActive, status, storeId, router, role, skipCheck])

  return {
    isLoading: authLoading || !hasChecked,
    isActive,
    status,
    storeName: store?.name || null,
  }
}
