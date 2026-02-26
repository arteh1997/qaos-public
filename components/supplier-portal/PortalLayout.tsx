'use client'

import { useRouter, usePathname } from 'next/navigation'
import { usePortalAuth } from '@/hooks/useSupplierPortal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Package, FileText, ShoppingBag, LogOut } from 'lucide-react'
import { useEffect } from 'react'

const portalNav = [
  { title: 'Orders', href: '/portal/orders', icon: Package },
  { title: 'Invoices', href: '/portal/invoices', icon: FileText },
  { title: 'Catalog', href: '/portal/catalog', icon: ShoppingBag },
]

interface PortalLayoutProps {
  children: React.ReactNode
  title?: string
}

export function PortalLayout({ children, title }: PortalLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, clearToken } = usePortalAuth()

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/portal')
    }
  }, [isAuthenticated, router])

  if (!isAuthenticated) return null

  const handleLogout = () => {
    clearToken()
    router.replace('/portal')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-navbar text-navbar-foreground">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-sm font-semibold tracking-tight">Supplier Portal</span>
          <Button variant="ghost" size="sm" className="text-navbar-foreground hover:bg-card/10" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Navigation tabs */}
      <nav className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {portalNav.map(item => {
            const isActive = pathname.startsWith(item.href)
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {title && (
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        )}
        {children}
      </main>
    </div>
  )
}
