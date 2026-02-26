'use client'

import { Plug, ArrowRight } from 'lucide-react'
import { ScrollReveal } from './ScrollReveal'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const posProviders = [
  'Square',
  'Toast',
  'Clover',
  'Lightspeed',
  'TouchBistro',
  'Revel',
  'Aloha',
  'SpotOn',
  'Upserve',
  'Lavu',
  'Talech',
  'Rezku',
  'Heartland',
  'Aldelo',
  'Epos Now',
  'Loyverse',
  'Vend',
  'Shopify POS',
  'Hike',
  'Custom API',
]

const accountingProviders = [
  'Xero',
  'QuickBooks',
  'Sage',
  'MYOB',
  'FreshBooks',
  'Zoho Books',
  'Wave',
]

export function Integrations() {
  return (
    <section id="integrations" className="py-24 lg:py-36 bg-muted/20 scroll-mt-24">
      <div className="container mx-auto px-6 lg:px-8">
        <ScrollReveal>
          <div className="mx-auto max-w-3xl text-center mb-16 lg:mb-20">
            <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-primary/20 bg-primary/5 px-5 py-2.5 text-sm font-medium text-primary">
              <Plug className="h-4 w-4" />
              Plug and play
            </div>
            <h2 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl leading-tight">
              Connects to the tools you already use
            </h2>
            <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed">
              Automatically deduct inventory on every sale. No manual work, no missed updates.
            </p>
          </div>
        </ScrollReveal>

        {/* POS Providers grid */}
        <ScrollReveal delay={100}>
          <div className="max-w-5xl mx-auto">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider text-center mb-6">
              20+ POS Providers
            </h3>
            <div className="flex flex-wrap justify-center gap-3 mb-12">
              {posProviders.map((provider, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border/60 bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-card hover:border-primary/30 hover:shadow-lg transition-all duration-300"
                >
                  {provider}
                </div>
              ))}
            </div>

            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider text-center mb-6">
              Accounting
            </h3>
            <div className="flex flex-wrap justify-center gap-3 mb-12">
              {accountingProviders.map((provider, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border/60 bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-card hover:border-primary/30 hover:shadow-lg transition-all duration-300"
                >
                  {provider}
                </div>
              ))}
            </div>

            <div className="text-center">
              <p className="text-muted-foreground mb-6">
                Don&apos;t see yours? We support custom API integrations too.
              </p>
              <Button asChild variant="outline" size="lg" className="px-8 py-6 h-auto text-base">
                <Link href="/login?signup=true">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
