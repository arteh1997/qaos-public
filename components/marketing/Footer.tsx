import Link from 'next/link'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border/60 bg-muted/10 py-16 lg:py-20">
      <div className="container mx-auto px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Logo & Description */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/20">
                <span className="text-xl font-bold text-primary-foreground">R</span>
              </div>
              <span className="text-xl font-bold text-foreground">RestaurantOS</span>
            </Link>
            <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">
              Restaurant inventory management software built for serious operators.
              Track stock, manage shifts, and control costs across all your locations.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Product</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Pricing
                </a>
              </li>
              <li>
                <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/login?signup=true" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Start Free Trial
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Legal</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Cookie Policy
                </Link>
              </li>
              <li>
                <a href="mailto:hello@restaurantos.com" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Contact Us
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border/40">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {currentYear} RestaurantOS. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
                Terms
              </Link>
              <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
                Privacy
              </Link>
              <Link href="/cookies" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
