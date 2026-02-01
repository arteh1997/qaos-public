'use client'

import { memo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { AppRole, LegacyAppRole } from '@/types'
import {
  LayoutDashboard,
  Store,
  Package,
  Users,
  FileText,
  Clock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { normalizeRole } from '@/lib/auth'
import { StoreSelector } from './StoreSelector'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: AppRole[]
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
    title: 'Stores',
    href: '/stores',
    icon: Store,
    roles: ['Owner', 'Manager', 'Driver', 'Staff'],
  },
  {
    title: 'Inventory',
    href: '/inventory',
    icon: Package,
    roles: ['Owner', 'Manager'],
  },
  {
    title: 'Users',
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
  },
]

interface SidebarProps {
  role: AppRole | LegacyAppRole | null
}

export const Sidebar = memo(function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  // Normalize legacy roles (Admin -> Owner)
  const normalizedRole = normalizeRole(role)

  const filteredItems = navItems.filter(item =>
    normalizedRole && item.roles.includes(normalizedRole)
  )

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col bg-card/50 dark:bg-card/30 border-r backdrop-blur-sm transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className={cn(
        'flex items-center h-16 border-b px-4',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <Link href="/" className="font-semibold text-lg hover:text-primary transition-colors">
            Inventory
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Store selector for multi-store users */}
      <StoreSelector collapsed={collapsed} className="py-2 border-b" />

      <nav className="flex-1 p-2 space-y-1" aria-label="Primary">
        {filteredItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:translate-x-1',
                collapsed && 'justify-center px-2 hover:translate-x-0'
              )}
              title={collapsed ? item.title : undefined}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              {!collapsed ? <span>{item.title}</span> : <span className="sr-only">{item.title}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
})
