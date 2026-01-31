'use client'

import { memo } from 'react'
import { UserNav } from './UserNav'
import { MobileNav } from './MobileNav'
import { AppRole } from '@/types'

interface HeaderProps {
  role: AppRole | null
}

export const Header = memo(function Header({ role }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md dark:bg-background/60"
      role="banner"
    >
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <MobileNav role={role} />
          <span className="font-semibold md:hidden" aria-label="Restaurant Inventory Management">Inventory</span>
        </div>
        <UserNav />
      </div>
    </header>
  )
})
