'use client'

import { useAuth } from '@/hooks/useAuth'
import { AppRole } from '@/types'

interface StoreContext {
  storeId: string
  role: AppRole | null
  userId: string
  isLoading: boolean
}

interface StorePageWrapperProps {
  children: (context: StoreContext) => React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Client component that provides auth context via render props.
 * Allows parent pages to remain Server Components while still accessing auth.
 *
 * Usage:
 * ```tsx
 * // In a Server Component page:
 * export default function MyPage() {
 *   return (
 *     <StorePageWrapper>
 *       {({ storeId, role }) => <MyClientContent storeId={storeId} role={role} />}
 *     </StorePageWrapper>
 *   )
 * }
 * ```
 */
export function StorePageWrapper({ children, fallback }: StorePageWrapperProps) {
  const { currentStore, role, user, isLoading } = useAuth()

  if (isLoading) {
    return fallback ? <>{fallback}</> : null
  }

  const storeId = currentStore?.store_id || ''
  const userId = user?.id || ''

  return <>{children({ storeId, role, userId, isLoading })}</>
}
