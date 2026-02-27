'use client'

import { memo } from 'react'
import Link from 'next/link'
import { UserNav } from './UserNav'
import { MobileNav } from './MobileNav'
import { OfflineIndicator } from '@/components/offline/OfflineIndicator'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { AppRole } from '@/types'

interface NavbarProps {
  role: AppRole | null
}

/**
 * Top navbar with black background
 * Contains logo, notifications, and profile
 */
export const Navbar = memo(function Navbar({ role }: NavbarProps) {
  return (
    <header
      className="sticky top-0 z-50 bg-navbar border-b border-navbar/80 print:hidden"
      role="banner"
    >
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <MobileNav role={role} variant="navbar" />
          <Link
            href="/"
            className="font-semibold text-lg text-navbar-foreground hover:opacity-80 transition-opacity"
          >
            Qaos
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <OfflineIndicator />
          <NotificationBell />
          <UserNav variant="navbar" />
        </div>
      </div>
    </header>
  )
})
