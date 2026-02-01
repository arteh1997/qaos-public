import { Button } from '@/components/ui/button'
import { Check, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const features = [
  'Real-time stock tracking',
  'Shift scheduling & timetables',
  'Multi-location dashboard',
  'Low stock alerts',
  'Reports & analytics',
  'Audit trail',
  'Data export (CSV)',
  'Mobile-friendly',
  'Unlimited inventory items',
  'Unlimited team members',
  'Priority support',
]

export function Pricing() {
  return (
    <section id="pricing" className="bg-muted/20 py-24 lg:py-36 scroll-mt-20">
      <div className="container mx-auto px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center mb-20">
          <h2 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl leading-tight">
            Simple, transparent pricing
          </h2>
          <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed">
            One plan. Everything included. Pay per location.
          </p>
        </div>

        <div className="mx-auto max-w-xl">
          {/* Single Pricing Card */}
          <div className="relative rounded-3xl border-2 border-primary bg-card p-10 lg:p-12 shadow-xl shadow-primary/10">
            <div className="absolute -top-5 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25">
                14-Day Free Trial
              </span>
            </div>

            <div className="text-center mb-10 pt-4">
              <h3 className="text-2xl font-bold text-foreground mb-3">Professional</h3>
              <p className="text-muted-foreground">For serious restaurant operators</p>
            </div>

            <div className="text-center mb-10">
              <span className="text-6xl font-bold text-foreground tracking-tight">£299</span>
              <span className="text-muted-foreground ml-2 text-lg">/ store / month</span>
            </div>

            <ul className="mb-10 space-y-4">
              {features.map((feature, index) => (
                <li key={index} className="flex items-center gap-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <Button asChild className="w-full py-7 text-lg h-auto shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all duration-300">
              <Link href="/login?signup=true">
                Start Free Trial
                <ArrowRight className="ml-2.5 h-5 w-5" />
              </Link>
            </Button>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              No credit card required to start. Cancel anytime.
            </p>
          </div>

          {/* Volume discount note */}
          <div className="mt-10 rounded-2xl border border-border/60 bg-card p-8 text-center">
            <p className="text-foreground font-semibold mb-2">Running 5+ locations?</p>
            <p className="text-muted-foreground leading-relaxed">
              Contact us for volume pricing.{' '}
              <a href="mailto:hello@restaurantos.com" className="text-primary hover:underline font-medium">
                hello@restaurantos.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
