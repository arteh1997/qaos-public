'use client'

import { memo, useMemo } from 'react'
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
  FolderTree,
  Tag,
  Trash2,
  Truck,
  ChefHat,
  Settings,
  ClipboardList,
  AlertTriangle,
  PackageCheck,
} from 'lucide-react'
import { normalizeRole } from '@/lib/auth'
import { Separator } from '@/components/ui/separator'
import { StoreSelector } from './StoreSelector'
import { useAuth } from '@/hooks/useAuth'

type NavSection = 'operations' | 'organisation' | 'team' | 'insights' | 'system'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: AppRole[]
  section: NavSection
  requiresBillingOwner?: boolean
}

const navItems: NavItem[] = [
  // Operations
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    roles: ['Owner', 'Manager', 'Driver', 'Staff'],
    section: 'operations',
  },
  {
    title: 'Inventory',
    href: '/inventory',
    icon: Package,
    roles: ['Owner', 'Manager'],
    section: 'operations',
  },
  {
    title: 'Waste Tracking',
    href: '/waste',
    icon: Trash2,
    roles: ['Owner', 'Manager', 'Staff'],
    section: 'operations',
  },
  {
    title: 'Suppliers',
    href: '/suppliers',
    icon: Truck,
    roles: ['Owner', 'Manager'],
    section: 'operations',
  },
  {
    title: 'Stock Count',
    href: '/stock-count',
    icon: ClipboardList,
    roles: ['Staff'],
    section: 'operations',
  },
  {
    title: 'Low Stock',
    href: '/low-stock',
    icon: AlertTriangle,
    roles: ['Staff'],
    section: 'operations',
  },
  {
    title: 'Deliveries',
    href: '/deliveries',
    icon: PackageCheck,
    roles: ['Driver'],
    section: 'operations',
  },

  // Organisation
  {
    title: 'Categories',
    href: '/categories',
    icon: FolderTree,
    roles: ['Owner', 'Manager'],
    section: 'organisation',
  },
  {
    title: 'Tags',
    href: '/tags',
    icon: Tag,
    roles: ['Owner', 'Manager'],
    section: 'organisation',
  },
  {
    title: 'Recipes',
    href: '/recipes',
    icon: ChefHat,
    roles: ['Owner', 'Manager'],
    section: 'organisation',
  },

  // Team
  {
    title: 'Team',
    href: '/users',
    icon: Users,
    roles: ['Owner', 'Manager'],
    section: 'team',
  },
  {
    title: 'Shifts',
    href: '/shifts',
    icon: Clock,
    roles: ['Owner', 'Manager'],
    section: 'team',
  },
  {
    title: 'My Shifts',
    href: '/my-shifts',
    icon: Clock,
    roles: ['Staff', 'Driver'],
    section: 'team',
  },

  // Insights
  {
    title: 'Reports',
    href: '/reports',
    icon: FileText,
    roles: ['Owner', 'Manager', 'Driver'],
    section: 'insights',
  },

  // System
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['Owner', 'Manager'],
    section: 'system',
  },
  {
    title: 'Billing',
    href: '/billing',
    icon: CreditCard,
    roles: ['Owner'],
    section: 'system',
    requiresBillingOwner: true,
  },
]

const SECTION_ORDER: NavSection[] = ['operations', 'organisation', 'team', 'insights', 'system']

const SECTION_LABELS: Record<NavSection, string> = {
  operations: 'Operations',
  organisation: 'Organisation',
  team: 'Team',
  insights: 'Insights',
  system: 'System',
}

interface SidebarProps {
  role: AppRole | LegacyAppRole | null
}

export const Sidebar = memo(function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const { currentStore } = useAuth()

  const normalizedRole = normalizeRole(role)
  const isBillingOwner = currentStore?.is_billing_owner === true

  const groupedItems = useMemo(() => {
    const filtered = navItems.filter(item => {
      if (!normalizedRole || !item.roles.includes(normalizedRole)) return false
      if (item.requiresBillingOwner && !isBillingOwner) return false
      return true
    })

    const groups: Partial<Record<NavSection, NavItem[]>> = {}
    for (const item of filtered) {
      if (!groups[item.section]) groups[item.section] = []
      groups[item.section]!.push(item)
    }
    return groups
  }, [normalizedRole, isBillingOwner])

  const visibleSections = SECTION_ORDER.filter(s => groupedItems[s]?.length)

  return (
    <aside
      className="hidden md:flex flex-col w-60 bg-sidebar border-r border-sidebar-border"
      role="navigation"
      aria-label="Main navigation"
    >
      <StoreSelector className="py-2 border-b border-sidebar-border" />

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto" aria-label="Primary">
        {visibleSections.map((section, sectionIdx) => {
          const items = groupedItems[section]!

          return (
            <div key={section}>
              {sectionIdx > 0 && (
                <Separator className="my-2 bg-sidebar-border" />
              )}
              <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {SECTION_LABELS[section]}
              </p>
              {items.map((item) => {
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
            </div>
          )
        })}
      </nav>
    </aside>
  )
})
