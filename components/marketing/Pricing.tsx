'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight, Check } from 'lucide-react'
import Link from 'next/link'
import { useCurrencyDetection } from '@/hooks/useCurrencyDetection'
import { VOLUME_DISCOUNTS, calculateMonthlyBill } from '@/lib/stripe/billing-config'
import { ScrollReveal } from './ScrollReveal'

const highlights = [
  'All features included',
  'Unlimited inventory items',
  'Unlimited team members',
  'Priority support',
]

export function Pricing() {
  const { tier } = useCurrencyDetection()

  // Format the display price (convert from smallest unit)
  const displayPrice = (tier.amount / 100).toLocaleString(tier.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  return (
    <section id="pricing" className="bg-muted/20 py-24 lg:py-36 scroll-mt-24">
      <div className="container mx-auto px-6 lg:px-8">
        <ScrollReveal>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl leading-tight">
              Software that pays for itself
            </h2>
            <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed mb-16">
              Enterprise tools charge 3-5x more for the same features.
              Most customers save over {tier.symbol}{displayPrice} in the first month alone.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={100}>
          <div className="mx-auto max-w-xl">
            {/* Glassmorphism pricing card */}
            <div className="relative rounded-3xl border-2 border-primary/30 p-10 lg:p-12 shadow-xl glass gradient-border">
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25">
                  1-Month Free Trial
                </span>
              </div>

              <div className="text-center mb-10 pt-4">
                <div className="mb-2">
                  <span className="text-5xl sm:text-6xl font-bold text-foreground tracking-tight">
                    {tier.symbol}{displayPrice}
                  </span>
                  <span className="text-muted-foreground ml-2 text-lg">/ store / month</span>
                </div>
              </div>

              {/* Quick highlights */}
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 mb-10">
                {highlights.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 text-muted-foreground">
                    <Check className="h-4 w-4 text-[#2d7a4f]" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>

              {/* CTA buttons */}
              <div className="flex flex-col gap-3">
                <Button asChild size="lg" className="w-full text-lg px-8 py-6 h-auto shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all duration-300">
                  <Link href="/login?signup=true">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="w-full text-lg px-8 py-6 h-auto">
                  <Link href="/pricing">
                    See Full Pricing Details
                  </Link>
                </Button>
              </div>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                1-month free trial. Cancel anytime.
              </p>
            </div>

            {/* Volume discounts */}
            <ScrollReveal delay={200}>
              <div className="mt-8 rounded-2xl border border-border/60 bg-card p-6 shadow-card">
                <p className="text-sm font-semibold text-foreground mb-4 text-center">
                  Growing? The more stores, the less you pay.
                </p>
                <div className="space-y-3">
                  {VOLUME_DISCOUNTS.map((vd, i) => {
                    const bill = calculateMonthlyBill(vd.minStores, tier.currency.toUpperCase())
                    const totalDisplay = (bill.total / 100).toLocaleString(tier.locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                    const savedDisplay = (bill.discount / 100).toLocaleString(tier.locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                    return (
                      <div key={i} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
                        <div>
                          <span className="text-sm font-medium text-foreground">{vd.minStores}+ stores</span>
                          <span className="ml-2 inline-flex items-center rounded-full bg-[#2d7a4f]/10 px-2 py-0.5 text-xs font-semibold text-[#2d7a4f]">
                            {vd.discountPercent}% off
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-foreground">{tier.symbol}{totalDisplay}/mo</span>
                          <span className="ml-2 text-xs text-[#2d7a4f]">save {tier.symbol}{savedDisplay}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </ScrollReveal>

            {/* ROI comparison */}
            <ScrollReveal delay={300}>
              <div className="mt-6 rounded-2xl border border-[#2d7a4f]/30 bg-[#2d7a4f]/5 p-8 text-center">
                <p className="text-foreground font-semibold mb-2">Your investment vs your return</p>
                <div className="flex items-center justify-center gap-4 text-lg">
                  <span className="text-muted-foreground">{tier.symbol}{displayPrice}/month</span>
                  <ArrowRight className="h-5 w-5 text-[#2d7a4f]" />
                  <span className="text-[#2d7a4f] font-bold">3-7x return in savings</span>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
