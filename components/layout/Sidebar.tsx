'use client'

import { memo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { AppRole } from '@/types'
import {
  LayoutDashboard,
  Store,
  Package,
  Users,
  FileText,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: AppRole[]
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    roles: ['Admin', 'Driver', 'Staff'],
  },
  {
    title: 'Stores',
    href: '/stores',
    icon: Store,
    roles: ['Admin', 'Driver', 'Staff'],
  },
  {
    title: 'Inventory',
    href: '/inventory',
    icon: Package,
    roles: ['Admin'],
  },
  {
    title: 'Users',
    href: '/users',
    icon: Users,
    roles: ['Admin'],
  },
  {
    title: 'Shifts',
    href: '/shifts',
    icon: Clock,
    roles: ['Admin'],
  },
  {
    title: 'Reports',
    href: '/reports',
    icon: FileText,
    roles: ['Admin', 'Driver'],
  },
  {
    title: 'My Shifts',
    href: '/my-shifts',
    icon: Clock,
    roles: ['Staff'],
  },
]

interface SidebarProps {
  role: AppRole | null
}

export const Sidebar = memo(function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const filteredItems = navItems.filter(item =>
    role && item.roles.includes(role)
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
          <span className="font-semibold text-lg">Inventory</span>
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
