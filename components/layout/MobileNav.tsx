'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { AppRole, LegacyAppRole } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { normalizeRole } from '@/lib/auth'
import { ROLE_LABELS } from '@/lib/constants'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  LayoutDashboard,
  Store,
  Package,
  Users,
  FileText,
  Clock,
  Menu,
  LogOut,
  Check,
  ChevronRight,
  CreditCard,
} from 'lucide-react'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: AppRole[]
  requiresBillingOwner?: boolean
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
    requiresBillingOwner: true,
  },
]

interface MobileNavProps {
  role: AppRole | LegacyAppRole | null
}

export function MobileNav({ role }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const [storesExpanded, setStoresExpanded] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { signOut, stores, currentStore, setCurrentStore, isMultiStoreUser } = useAuth()

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

  const handleLogout = async () => {
    setOpen(false)
    await signOut()
  }

  const handleStoreSelect = (storeId: string) => {
    setCurrentStore(storeId)
    setStoresExpanded(false)
    setOpen(false)
    router.push('/')
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 flex flex-col">
        <div className="flex h-16 items-center border-b px-6">
          <SheetTitle className="font-semibold text-lg">Restaurant Inventory</SheetTitle>
        </div>

        {/* Store Selector for multi-store users */}
        {isMultiStoreUser && stores.length > 1 && (
          <div className="border-b">
            <button
              onClick={() => setStoresExpanded(!storesExpanded)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent transition-colors"
              aria-expanded={storesExpanded}
            >
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-muted-foreground" />
                <div className="text-left">
                  <p className="text-sm font-medium truncate max-w-[160px]">
                    {currentStore?.store?.name || 'Select Store'}
                  </p>
                  {currentStore && (
                    <p className="text-xs text-muted-foreground">
                      {ROLE_LABELS[currentStore.role]}
                    </p>
                  )}
                </div>
              </div>
              <ChevronRight className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                storesExpanded && 'rotate-90'
              )} />
            </button>

            {/* Store list */}
            {storesExpanded && (
              <div className="pb-2 px-2 space-y-1">
                {stores.map((storeUser) => (
                  <button
                    key={storeUser.store_id}
                    onClick={() => handleStoreSelect(storeUser.store_id)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                      currentStore?.store_id === storeUser.store_id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-accent'
                    )}
                  >
                    <div className="flex flex-col items-start min-w-0 flex-1">
                      <span className="font-medium truncate max-w-[180px]">
                        {storeUser.store?.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {ROLE_LABELS[storeUser.role]}
                        </span>
                        {storeUser.is_billing_owner && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">
                            Billing
                          </Badge>
                        )}
                      </div>
                    </div>
                    {currentStore?.store_id === storeUser.store_id && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Single store indicator */}
        {!isMultiStoreUser && currentStore && (
          <div className="border-b px-4 py-3">
            <div className="flex items-center gap-3">
              <Store className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium truncate max-w-[180px]">
                  {currentStore.store?.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ROLE_LABELS[currentStore.role]}
                </p>
              </div>
            </div>
          </div>
        )}

        <nav className="flex flex-col gap-1 p-4 flex-1 overflow-y-auto" aria-label="Mobile navigation">
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
        <div className="border-t p-4 mt-auto">
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
