import { Button } from '@/components/ui/button'
import { ArrowRight, Check } from 'lucide-react'
import Link from 'next/link'

const highlights = [
  'All features included',
  'Unlimited inventory items',
  'Unlimited team members',
  'Priority support',
]

export function Pricing() {
  return (
    <section id="pricing" className="bg-muted/20 py-24 lg:py-36 scroll-mt-24">
      <div className="container mx-auto px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl leading-tight">
            Software that pays for itself
          </h2>
          <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed mb-12">
            Most customers save £1,000+ per month through reduced waste, better ordering, and time savings.
          </p>

          {/* Price highlight */}
          <div className="inline-flex flex-col items-center mb-10">
            <div className="mb-4">
              <span className="text-5xl sm:text-6xl font-bold text-foreground tracking-tight">£299</span>
              <span className="text-muted-foreground ml-2 text-lg">/ store / month</span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
              1-Month Free Trial
            </span>
          </div>

          {/* Quick highlights */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 mb-12">
            {highlights.map((item, index) => (
              <div key={index} className="flex items-center gap-2 text-muted-foreground">
                <Check className="h-4 w-4 text-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-8 py-6 h-auto shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all duration-300 w-full sm:w-auto">
              <Link href="/login?signup=true">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6 h-auto w-full sm:w-auto">
              <Link href="/pricing">
                See Full Pricing Details
              </Link>
            </Button>
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            See how RestaurantOS saves you money →{' '}
            <Link href="/pricing" className="text-primary hover:underline font-medium">
              View pricing breakdown
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
