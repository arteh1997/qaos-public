import Link from 'next/link'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-[#2d2a26] text-[#faf8f5]">
      <div className="container mx-auto px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          {/* Col 1: Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                <span className="text-lg font-bold text-white">R</span>
              </div>
              <span className="text-lg font-semibold text-white">RestaurantOS</span>
            </Link>
            <p className="text-sm text-[#8a8279] leading-relaxed max-w-xs">
              The all-in-one platform for restaurant inventory, team management, and cost control.
            </p>
          </div>

          {/* Col 2: Product */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="#features" className="text-[#8a8279] hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <Link href="/pricing" className="text-[#8a8279] hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <a href="#features" className="text-[#8a8279] hover:text-white transition-colors">
                  Integrations
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Resources */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Resources</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="mailto:support@restaurantos.com" className="text-[#8a8279] hover:text-white transition-colors">
                  Help Centre
                </a>
              </li>
              <li>
                <a href="#" className="text-[#8a8279] hover:text-white transition-colors">
                  API Docs
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Company */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Company</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="mailto:hello@restaurantos.com" className="text-[#8a8279] hover:text-white transition-colors">
                  Contact
                </a>
              </li>
              <li>
                <Link href="/terms" className="text-[#8a8279] hover:text-white transition-colors">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-[#8a8279] hover:text-white transition-colors">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="text-[#8a8279] hover:text-white transition-colors">
                  Cookies
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-white/10">
          <p className="text-sm text-[#8a8279]">
            &copy; {currentYear} RestaurantOS. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
