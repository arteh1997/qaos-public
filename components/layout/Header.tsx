'use client'

import { memo } from 'react'
import { UserNav } from './UserNav'
import { MobileNav } from './MobileNav'
import { useAuth } from '@/hooks/useAuth'
import { AppRole } from '@/types'
import { Store } from 'lucide-react'

interface HeaderProps {
  role: AppRole | null
}

export const Header = memo(function Header({ role }: HeaderProps) {
  const { currentStore, isMultiStoreUser } = useAuth()

  return (
    <header
      className="sticky top-0 z-40 border-b bg-background"
      role="banner"
    >
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <MobileNav role={role} />
          {/* Show store name on mobile, or app name if no store */}
          <div className="md:hidden flex items-center gap-2 min-w-0">
            {currentStore ? (
              <>
                <Store className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-semibold truncate max-w-[140px] sm:max-w-[200px]">
                  {currentStore.store?.name}
                </span>
                {isMultiStoreUser && (
                  <span className="text-xs text-muted-foreground flex-shrink-0">(tap menu to switch)</span>
                )}
              </>
            ) : (
              <span className="font-semibold">Inventory</span>
            )}
          </div>
        </div>
        <UserNav />
      </div>
    </header>
  )
})
