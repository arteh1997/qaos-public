'use client'

import { Store, ClipboardCheck, TrendingDown, Shield } from 'lucide-react'
import { AnimatedCounter } from './AnimatedCounter'
import { ScrollReveal } from './ScrollReveal'

const metrics = [
  { icon: Store, value: 200, suffix: '+', label: 'Restaurants' },
  { icon: ClipboardCheck, value: 50000, suffix: '+', label: 'Stock Counts' },
  { icon: TrendingDown, prefix: '£', value: 2, suffix: 'M+', label: 'Waste Prevented' },
  { icon: Shield, value: 99.9, suffix: '%', label: 'Uptime' },
]

export function TrustBar() {
  return (
    <ScrollReveal>
      <section className="border-y border-border/40 bg-background py-8 lg:py-10">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 lg:gap-x-20">
            {metrics.map((metric, i) => (
              <div key={i} className="flex items-center gap-3 text-muted-foreground">
                <metric.icon className="h-5 w-5 shrink-0 opacity-60" />
                <div className="flex items-baseline gap-1.5">
                  <AnimatedCounter
                    target={metric.value}
                    prefix={metric.prefix}
                    suffix={metric.suffix}
                    className="text-lg font-semibold text-foreground"
                  />
                  <span className="text-sm">{metric.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </ScrollReveal>
  )
}
