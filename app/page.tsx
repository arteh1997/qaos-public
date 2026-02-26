'use client'

import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

// Landing page components
import {
  MarketingHeader,
  Hero,
  PainPoints,
  ProductShowcase,
  Features,
  Integrations,
  Pricing,
  FAQ,
  CTA,
  Footer,
} from '@/components/marketing'

// Dashboard components
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import { GlobalKeyboardShortcuts } from '@/components/GlobalKeyboardShortcuts'
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { OwnerDashboard } from '@/components/dashboard/OwnerDashboard'
import { StaffDashboard } from '@/components/dashboard/StaffDashboard'
import { Skeleton } from '@/components/ui/skeleton'

// Check if there's an auth cookie present (indicates user might be logged in)
function hasAuthCookie(): boolean {
  if (typeof document === 'undefined') return false
  const cookies = document.cookie.split(';')
  return cookies.some(cookie => {
    const trimmed = cookie.trim()
    return trimmed.startsWith('sb-') && trimmed.includes('auth-token')
  })
}

/**
 * Smart Home Page
 *
 * Shows different content based on authentication state:
 * - Unauthenticated: Marketing landing page
 * - Authenticated: Dashboard with full layout
 *
 * This follows the Facebook/Twitter pattern where the home URL (/)
 * adapts to the user's authentication state.
 */
export default function HomePage() {
  const router = useRouter()
  const { user, role, isLoading, stores } = useAuth()

  // Track if we've detected an auth cookie - prevents flash of landing page after login
  // Initialize with actual check to avoid flash on first render
  const [hasCookie, setHasCookie] = useState(() => hasAuthCookie())

  // Re-check cookie when auth state changes (handles logout clearing cookies)
  useEffect(() => {
    if (!isLoading && !user) {
      setHasCookie(hasAuthCookie())
    }
  }, [isLoading, user])

  // Redirect to onboarding if user has no stores
  useEffect(() => {
    if (!isLoading && user && stores && stores.length === 0) {
      router.push('/onboarding')
    }
  }, [isLoading, user, stores, router])

  // Show loading state while auth is loading
  // Also show loading if there's an auth cookie but user isn't loaded yet
  // (prevents flash of landing page after login)
  if (isLoading || (hasCookie && !user)) {
    return <LoadingSkeleton />
  }

  // Not authenticated - show landing page
  if (!user) {
    return (
      <div className="min-h-screen bg-background antialiased scroll-smooth">
        <MarketingHeader />
        <main>
          <Hero />
          <PainPoints />
          <ProductShowcase />
          <Features />
          <Integrations />
          <Pricing />
          <FAQ />
          <CTA />
        </main>
        <Footer />
      </div>
    )
  }

  // Authenticated but no stores - show loading while redirecting to onboarding
  if (stores && stores.length === 0) {
    return <LoadingSkeleton />
  }

  // Authenticated - show dashboard
  const effectiveRole = role || 'Owner'

  return (
    <div className="fixed inset-0 flex flex-col bg-background text-foreground">
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

      {/* Sidebar stays fixed, only main content scrolls */}
      <div className="flex flex-1 min-h-0">
        <Sidebar role={role} />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto bg-background"
          role="main"
          aria-label="Main content"
          tabIndex={-1}
        >
          <div className="mx-auto max-w-6xl px-6 py-6 md:px-10 md:py-8">
            <ErrorBoundary>
              <DashboardContent role={effectiveRole} />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  )
}

function DashboardContent({ role }: { role: string }) {
  switch (role) {
    case 'Owner':
    case 'Manager':
      return <OwnerDashboard key="owner-dashboard" />
    case 'Staff':
      return <StaffDashboard key="staff-dashboard" />
    default:
      return <OwnerDashboard key="owner-dashboard-default" />
  }
}

function LoadingSkeleton() {
  return (
    <div className="fixed inset-0 flex flex-col bg-background text-foreground">
      {/* Navbar skeleton */}
      <div className="h-14 bg-black px-4 flex items-center justify-between">
        <Skeleton className="h-6 w-32 bg-white/20" />
        <Skeleton className="h-10 w-10 rounded-full bg-white/20" />
      </div>
      <div className="flex flex-1 min-h-0">
        {/* Sidebar skeleton */}
        <div className="hidden md:block w-60 border-r bg-sidebar">
          <div className="p-4 space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
        {/* Content skeleton */}
        <div className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto max-w-6xl px-6 py-6 md:px-10 md:py-8">
            <Skeleton className="h-8 w-48 mb-6" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
