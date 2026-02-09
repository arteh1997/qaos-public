'use client'

import { memo } from 'react'
import Link from 'next/link'
import { UserNav } from './UserNav'
import { MobileNav } from './MobileNav'
import { AppRole } from '@/types'

interface NavbarProps {
  role: AppRole | null
}

/**
 * Top navbar with black background
 * Contains logo on the left and profile on the right
 */
export const Navbar = memo(function Navbar({ role }: NavbarProps) {
  return (
    <header
      className="sticky top-0 z-50 bg-black border-b border-black"
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
        <UserNav variant="navbar" />
      </div>
    </header>
  )
})
