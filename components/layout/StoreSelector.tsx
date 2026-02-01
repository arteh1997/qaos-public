'use client'

import { memo } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { cn } from '@/lib/utils'
import { Store, ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { ROLE_LABELS } from '@/lib/constants'

interface StoreSelectorProps {
  collapsed?: boolean
  className?: string
}

/**
 * Store selector component for multi-store users
 * Allows switching between stores the user has access to
 */
export const StoreSelector = memo(function StoreSelector({
  collapsed = false,
  className,
}: StoreSelectorProps) {
  const { stores, currentStore, setCurrentStore, isMultiStoreUser } = useAuth()

  // Don't render if user only has one store
  if (!isMultiStoreUser || stores.length <= 1) {
    return null
  }

  return (
    <div className={cn('px-2', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-between gap-2 h-auto py-2',
              collapsed && 'justify-center px-2'
            )}
            aria-label="Select store"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Store className="h-4 w-4 flex-shrink-0" />
              {!collapsed && (
                <div className="flex flex-col items-start text-left min-w-0">
                  <span className="text-sm font-medium truncate max-w-[140px]">
                    {currentStore?.store?.name || 'Select Store'}
                  </span>
                  {currentStore && (
                    <span className="text-xs text-muted-foreground">
                      {ROLE_LABELS[currentStore.role]}
                    </span>
                  )}
                </div>
              )}
            </div>
            {!collapsed && <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Your Stores</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {stores.map((storeUser) => (
            <DropdownMenuItem
              key={storeUser.store_id}
              onClick={() => setCurrentStore(storeUser.store_id)}
              className="flex items-center justify-between gap-2 cursor-pointer"
            >
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-medium truncate">
                  {storeUser.store?.name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {ROLE_LABELS[storeUser.role]}
                  </span>
                  {storeUser.is_billing_owner && (
                    <Badge variant="secondary" className="text-xs px-1 py-0">
                      Billing
                    </Badge>
                  )}
                </div>
              </div>
              {currentStore?.store_id === storeUser.store_id && (
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
})

/**
 * Compact store indicator for header
 * Shows current store without dropdown (clicking goes to stores page)
 */
export const StoreIndicator = memo(function StoreIndicator({
  className,
}: { className?: string }) {
  const { currentStore } = useAuth()

  if (!currentStore) return null

  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      <Store className="h-4 w-4 text-muted-foreground" />
      <span className="font-medium truncate max-w-[150px]">
        {currentStore.store?.name}
      </span>
      <Badge variant="outline" className="text-xs">
        {ROLE_LABELS[currentStore.role]}
      </Badge>
    </div>
  )
})
