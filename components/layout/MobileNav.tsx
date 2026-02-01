'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { AppRole, LegacyAppRole } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { normalizeRole } from '@/lib/auth'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Store,
  Package,
  Users,
  FileText,
  Clock,
  Menu,
  LogOut,
} from 'lucide-react'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: AppRole[]
}

// Navigation items with new role system
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
]

interface MobileNavProps {
  role: AppRole | LegacyAppRole | null
}

export function MobileNav({ role }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { signOut } = useAuth()

  // Normalize legacy roles (Admin -> Owner)
  const normalizedRole = normalizeRole(role)

  const filteredItems = navItems.filter(item =>
    normalizedRole && item.roles.includes(normalizedRole)
  )

  const handleLogout = async () => {
    setOpen(false)
    await signOut()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <div className="flex h-16 items-center border-b px-6">
          <SheetTitle className="font-semibold text-lg">Restaurant Inventory</SheetTitle>
        </div>
        <nav className="flex flex-col gap-1 p-4 flex-1" aria-label="Mobile navigation">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon className="h-5 w-5" aria-hidden="true" />
                <span>{item.title}</span>
              </Link>
            )
          })}
        </nav>
        <div className="border-t p-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            aria-label="Log out of your account"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
            <span>Log out</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
