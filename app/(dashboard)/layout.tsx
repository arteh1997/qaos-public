'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import { GlobalKeyboardShortcuts } from '@/components/GlobalKeyboardShortcuts'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { isLoading, role, user, stores } = useAuth()

  // Redirect to onboarding if user has no stores
  useEffect(() => {
    if (!isLoading && user && stores && stores.length === 0) {
      router.push('/onboarding')
    }
  }, [isLoading, user, stores, router])

  // Show nothing while redirecting to onboarding
  if (!isLoading && user && stores && stores.length === 0) {
    return null
  }

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground">
        {/* Navbar skeleton */}
        <div className="h-14 bg-black px-4 flex items-center justify-between">
          <Skeleton className="h-6 w-32 bg-white/20" />
          <Skeleton className="h-10 w-10 rounded-full bg-white/20" />
        </div>
        <div className="flex flex-1">
          {/* Sidebar skeleton */}
          <div className="hidden md:block w-60 border-r bg-sidebar">
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
          {/* Content skeleton */}
          <div className="flex-1 bg-background">
            <main className="flex-1 overflow-auto">
              <div className="mx-auto max-w-6xl px-6 py-6 md:px-10 md:py-8">
                <Skeleton className="h-8 w-48 mb-6" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <GlobalKeyboardShortcuts role={role} />
      <PWAInstallPrompt />

      {/* Black navbar at top - full width */}
      <Navbar role={role} />

      {/* Sidebar and content below */}
      <div className="flex flex-1">
        <Sidebar role={role} />
        <main
          id="main-content"
          className="flex-1 overflow-auto bg-background"
          role="main"
          aria-label="Main content"
          tabIndex={-1}
        >
          <div className="mx-auto max-w-6xl px-6 py-6 md:px-10 md:py-8">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  )
}
