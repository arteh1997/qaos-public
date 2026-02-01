import { ReactNode } from 'react'

/**
 * Marketing Layout
 *
 * Simple layout for public marketing pages (landing, pricing, etc.)
 * No sidebar, no authentication required.
 * Includes smooth scrolling and antialiased text for professional look.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background antialiased scroll-smooth">
      {children}
    </div>
  )
}
