'use client'

import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'

export function MarketingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto px-6 lg:px-8">
        <nav className="flex h-18 items-center justify-between lg:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/20">
              <span className="text-xl font-bold text-primary-foreground">R</span>
            </div>
            <span className="text-xl font-bold text-foreground">RestaurantOS</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-10 lg:flex">
            <a
              href="#features"
              className="text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              Pricing
            </a>
          </div>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-3 lg:flex">
            <ThemeToggle />
            <Button variant="ghost" className="text-sm font-medium" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild className="shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25 transition-all duration-300">
              <Link href="/login?signup=true">Get Started</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle />
            <button
              className="p-2 -mr-2 rounded-lg hover:bg-accent transition-colors duration-200"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
            {mobileMenuOpen ? (
              <X className="h-6 w-6 text-foreground" />
            ) : (
              <Menu className="h-6 w-6 text-foreground" />
            )}
            </button>
          </div>
        </nav>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="border-t border-border/60 py-6 lg:hidden animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-6">
              <a
                href="#features"
                className="text-base font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </a>
              <a
                href="#pricing"
                className="text-base font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </a>
              <div className="flex flex-col gap-3 pt-4 border-t border-border/60">
                <Button variant="outline" className="justify-center" asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link href="/login?signup=true">Get Started</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
