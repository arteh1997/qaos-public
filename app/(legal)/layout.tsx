import { ReactNode } from 'react'

/**
 * Legal Pages Layout
 *
 * Simple layout for legal pages (Terms, Privacy, Cookies).
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background antialiased">
      {children}
    </div>
  )
}
