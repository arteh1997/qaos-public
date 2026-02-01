import { ReactNode } from 'react'
import Link from 'next/link'

/**
 * Onboarding Layout
 *
 * Simple centered layout for onboarding flow.
 * Users see this when they've signed up but haven't created their first store yet.
 */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Simple header */}
      <header className="border-b border-border bg-background">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-lg font-bold text-primary-foreground">R</span>
              </div>
              <span className="text-lg font-bold text-foreground">RestaurantOS</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12">
        {children}
      </main>
    </div>
  )
}
