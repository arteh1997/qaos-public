'use client'

/**
 * Store Layout - Subscription Guard
 *
 * This layout wraps all store-specific pages and checks if the store
 * has an active subscription. If the subscription is expired, it
 * redirects to the subscription-expired page.
 *
 * The subscription-expired page is excluded from this check to avoid
 * infinite redirects.
 */

import { use } from 'react'
import { usePathname } from 'next/navigation'
import { useSubscriptionGuard } from '@/hooks/useSubscriptionGuard'
import { Skeleton } from '@/components/ui/skeleton'

interface StoreLayoutProps {
  children: React.ReactNode
  params: Promise<{ storeId: string }>
}

export default function StoreLayout({ children, params }: StoreLayoutProps) {
  const { storeId } = use(params)
  const pathname = usePathname()

  // Don't check subscription on the subscription-expired page itself
  const isExpiredPage = pathname?.includes('/subscription-expired')

  // Skip subscription check for the expired page
  const { isLoading, isActive } = useSubscriptionGuard(
    isExpiredPage ? null : storeId
  )

  // If on expired page, always render children
  if (isExpiredPage) {
    return <>{children}</>
  }

  // Show loading state while checking subscription
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32 mt-2" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  // If subscription is not active, the hook handles the redirect
  // Show nothing while redirecting
  if (!isActive) {
    return null
  }

  // Subscription is active - render the page
  return <>{children}</>
}
