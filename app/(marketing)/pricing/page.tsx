'use client'

import { Button } from '@/components/ui/button'
import { MarketingHeader } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { Check, ArrowRight, TrendingDown, Clock, AlertTriangle, PiggyBank } from 'lucide-react'
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

const savings = [
  {
    icon: TrendingDown,
    title: 'Reduce Food Waste by 15-25%',
    description: 'Better stock visibility and PAR level alerts help prevent over-ordering and spoilage.',
    saving: '£200-500/month',
  },
  {
    icon: Clock,
    title: 'Save 10+ Hours Per Week',
    description: 'Stop wrestling with spreadsheets. Automated stock counts and reports free up your managers.',
    saving: '£400-600/month',
  },
  {
    icon: AlertTriangle,
    title: 'Prevent Costly Stockouts',
    description: 'Never lose a sale because you ran out of a key ingredient. Low stock alerts keep you prepared.',
    saving: '£300-800/month',
  },
  {
    icon: PiggyBank,
    title: 'Smarter Ordering Decisions',
    description: 'Historical data and trends help you order the right amount at the right time.',
    saving: '£150-400/month',
  },
]

export default function PricingPage() {
  return (
    <>
      <MarketingHeader />
      <main>
        {/* Hero Section */}
        <section className="py-20 lg:py-28 bg-background">
          <div className="container mx-auto px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-tight">
                Software that pays for itself
              </h1>
              <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed">
                RestaurantOS isn&apos;t an expense—it&apos;s an investment that can save you thousands every month.
              </p>
            </div>
          </div>
        </section>

        {/* Value Justification Section */}
        <section className="py-20 lg:py-28 bg-muted/20">
          <div className="container mx-auto px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center mb-16">
              <h2 className="mb-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                How RestaurantOS saves you money
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Estimated savings based on industry waste reduction and time savings
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
              {savings.map((item, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-border/60 bg-card p-6 lg:p-8"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-600 flex-shrink-0">
                      <item.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{item.description}</p>
                      <p className="text-sm font-medium text-green-600">
                        Typical savings: {item.saving}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-5 py-2.5 text-sm font-medium text-green-600">
                <PiggyBank className="h-4 w-4" />
                Average total savings: £1,050 - £2,300/month per location
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="py-20 lg:py-28 bg-background">
          <div className="container mx-auto px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center mb-16">
              <h2 className="mb-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Simple, transparent pricing
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                One plan. Everything included. Pay per location.
              </p>
            </div>

            <div className="mx-auto max-w-xl">
              {/* Single Pricing Card */}
              <div className="relative rounded-3xl border-2 border-primary bg-card p-10 lg:p-12 shadow-xl shadow-primary/10">
                <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25">
                    1-Month Free Trial
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
                  1-month free trial. Cancel anytime.
                </p>
              </div>

              {/* ROI Calculator Summary */}
              <div className="mt-10 rounded-2xl border border-green-500/30 bg-green-500/5 p-8 text-center">
                <p className="text-foreground font-semibold mb-2">Your investment vs return</p>
                <div className="flex items-center justify-center gap-4 text-lg">
                  <span className="text-muted-foreground">£299/month</span>
                  <ArrowRight className="h-5 w-5 text-green-600" />
                  <span className="text-green-600 font-bold">£1,050 - £2,300 in savings</span>
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  That&apos;s a 3-7x return on your investment
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20 lg:py-28 bg-muted/20">
          <div className="container mx-auto px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl text-center mb-12">
                Common questions
              </h2>

              <div className="space-y-6">
                <div className="rounded-xl border border-border/60 bg-card p-6">
                  <h3 className="font-semibold text-foreground mb-2">How does the free trial work?</h3>
                  <p className="text-muted-foreground text-sm">
                    You get full access to all features for 1 month, completely free.
                    At the end of your trial, you can choose to subscribe or your account will be paused.
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-6">
                  <h3 className="font-semibold text-foreground mb-2">What happens to my data if I cancel?</h3>
                  <p className="text-muted-foreground text-sm">
                    Your data is yours. You can export everything at any time. If you cancel, we&apos;ll keep your data
                    for 30 days in case you change your mind, then it&apos;s permanently deleted.
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-6">
                  <h3 className="font-semibold text-foreground mb-2">Can I add more locations later?</h3>
                  <p className="text-muted-foreground text-sm">
                    Yes! You can add new locations at any time. Each location is billed separately at £299/month.
                    There&apos;s no limit to how many locations you can manage.
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-6">
                  <h3 className="font-semibold text-foreground mb-2">Is there a contract or commitment?</h3>
                  <p className="text-muted-foreground text-sm">
                    No long-term contracts. Pay month-to-month and cancel anytime. We believe in earning your
                    business every month, not locking you in.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 lg:py-28 bg-background">
          <div className="container mx-auto px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Ready to take control?
              </h2>
              <p className="mb-10 text-lg text-muted-foreground">
                Start saving thousands every month with better inventory management.
              </p>
              <Button asChild size="lg" className="text-lg px-10 py-7 h-auto shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all duration-300">
                <Link href="/login?signup=true">
                  Start Your Free Trial
                  <ArrowRight className="ml-2.5 h-5 w-5" />
                </Link>
              </Button>
              <p className="mt-6 text-sm text-muted-foreground">
                1-month free trial. Cancel anytime.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
