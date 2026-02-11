'use client'

import { memo } from 'react'
import Link from 'next/link'
import { UserNav } from './UserNav'
import { MobileNav } from './MobileNav'
import { OfflineIndicator } from '@/components/offline/OfflineIndicator'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { AppRole } from '@/types'
import { Search } from 'lucide-react'

interface NavbarProps {
  role: AppRole | null
  onOpenCommandPalette?: () => void
}

/**
 * Top navbar with black background
 * Contains logo, search trigger, notifications, and profile
 */
export const Navbar = memo(function Navbar({ role, onOpenCommandPalette }: NavbarProps) {
  return (
    <header
      className="sticky top-0 z-50 bg-black border-b border-black print:hidden"
      role="banner"
    >
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <MobileNav role={role} variant="navbar" />
          <Link
            href="/"
            className="font-semibold text-lg text-white hover:opacity-80 transition-opacity"
          >
            RestaurantOS
          </Link>
        </div>
        <div className="flex items-center gap-1">
          {/* Command palette trigger */}
          {onOpenCommandPalette && (
            <button
              onClick={onOpenCommandPalette}
              className="hidden sm:flex items-center gap-2 h-8 rounded-md border border-white/20 bg-white/5 px-3 text-xs text-white/60 hover:text-white/80 hover:bg-white/10 transition-colors"
            >
              <Search className="h-3 w-3" />
              <span>Search...</span>
              <kbd className="ml-2 inline-flex h-4 items-center rounded border border-white/20 bg-white/10 px-1 text-[10px] font-medium">
                &#8984;K
              </kbd>
            </button>
          )}
          <OfflineIndicator />
          <NotificationBell />
          <UserNav variant="navbar" />
        </div>
      </div>
    </header>
  )
})
