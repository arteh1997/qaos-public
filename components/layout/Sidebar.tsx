'use client'

import { memo } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { AppRole, LegacyAppRole } from '@/types'
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  Clock,
  CreditCard,
} from 'lucide-react'
import { normalizeRole } from '@/lib/auth'
import { StoreSelector } from './StoreSelector'
import { useAuth } from '@/hooks/useAuth'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: AppRole[]
  requiresBillingOwner?: boolean // For billing-only items
}

// Navigation items with new role system
// Owner: Full access (replaces Admin)
// Manager: Operational access to their store
// Staff: Limited access, clock in/out
// Driver: Multi-store delivery access
const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    roles: ['Owner', 'Manager', 'Driver', 'Staff'],
  },
  {
    title: 'Inventory',
    href: '/inventory',
    icon: Package,
    roles: ['Owner', 'Manager'],
  },
  {
    title: 'Team',
    href: '/users',
    icon: Users,
    roles: ['Owner', 'Manager'],
  },
  {
    title: 'Shifts',
    href: '/shifts',
    icon: Clock,
    roles: ['Owner', 'Manager'],
  },
  {
    title: 'Reports',
    href: '/reports',
    icon: FileText,
    roles: ['Owner', 'Manager', 'Driver'],
  },
  {
    title: 'My Shifts',
    href: '/my-shifts',
    icon: Clock,
    roles: ['Staff', 'Driver'],
  },
  {
    title: 'Billing',
    href: '/billing',
    icon: CreditCard,
    roles: ['Owner'],
    requiresBillingOwner: true, // Only the billing owner can access, not co-owners
  },
]

interface SidebarProps {
  role: AppRole | LegacyAppRole | null
}

export const Sidebar = memo(function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const { currentStore } = useAuth()

  // Normalize legacy roles (Admin -> Owner)
  const normalizedRole = normalizeRole(role)

  // Check if current user is the billing owner of the current store
  const isBillingOwner = currentStore?.is_billing_owner === true

  const filteredItems = navItems.filter(item => {
    // First check role access
    if (!normalizedRole || !item.roles.includes(normalizedRole)) {
      return false
    }
    // For billing items, also check if user is the billing owner
    if (item.requiresBillingOwner && !isBillingOwner) {
      return false
    }
    return true
  })

  return (
    <aside
      className="hidden md:flex flex-col w-60 bg-sidebar border-r border-sidebar-border"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Store selector for multi-store users */}
      <StoreSelector className="py-2 border-b border-sidebar-border" />

      <nav className="flex-1 p-2 space-y-0.5" aria-label="Primary">
        {filteredItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-semibold transition-colors',
                isActive
                  ? 'bg-white text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:text-sidebar-hover hover:bg-white/50'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              <span>{item.title}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
})
