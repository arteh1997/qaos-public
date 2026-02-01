import { ReactNode } from 'react'
import { ThemeToggle } from '@/components/ui/theme-toggle'

/**
 * Legal Pages Layout
 *
 * Simple layout for legal pages (Terms, Privacy, Cookies).
 * Includes theme toggle for consistency with other public pages.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background antialiased">
      {/* Theme Toggle - Fixed position */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      {children}
    </div>
  )
}
