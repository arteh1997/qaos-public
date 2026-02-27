'use client'

import { BarChart3, Bell, Smartphone, Truck } from 'lucide-react'
import Image from 'next/image'
import { ScrollReveal } from './ScrollReveal'

const callouts = [
  {
    icon: BarChart3,
    title: 'Real-time Analytics',
    description: 'Live stock levels, trends, and cost analysis at a glance.',
    position: 'left-top' as const,
  },
  {
    icon: Bell,
    title: 'Smart Alerts',
    description: 'Automatic low-stock and expiry warnings before they become problems.',
    position: 'left-bottom' as const,
  },
  {
    icon: Truck,
    title: 'Supplier Integration',
    description: 'Track deliveries, manage purchase orders, and compare supplier pricing.',
    position: 'right-top' as const,
  },
  {
    icon: Smartphone,
    title: 'Works Everywhere',
    description: 'Full mobile experience — scan barcodes, count stock, even offline.',
    position: 'right-bottom' as const,
  },
]

export function ProductShowcase() {
  return (
    <section id="product" className="py-24 lg:py-36 bg-muted/20 scroll-mt-24">
      <div className="container mx-auto px-6 lg:px-8">
        <ScrollReveal>
          <div className="mx-auto max-w-3xl text-center mb-16 lg:mb-20">
            <h2 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl leading-tight">
              See it in action
            </h2>
            <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed">
              One dashboard to run your entire operation.
              Here&apos;s what your team sees every day.
            </p>
          </div>
        </ScrollReveal>

        {/* Desktop: mockup centered with callouts on sides */}
        <div className="hidden lg:grid lg:grid-cols-[1fr_1.5fr_1fr] lg:gap-8 lg:items-center max-w-6xl mx-auto">
          {/* Left callouts */}
          <div className="space-y-10">
            {callouts.filter(c => c.position.startsWith('left')).map((callout, i) => (
              <ScrollReveal key={i} direction="right" delay={i * 100}>
                <CalloutCard {...callout} align="right" />
              </ScrollReveal>
            ))}
          </div>

          {/* Center screenshot */}
          <ScrollReveal direction="up" delay={100}>
            <div className="relative">
              <div className="absolute -inset-6 rounded-3xl bg-[#2d7a4f]/[0.03] blur-2xl" />
              <div className="relative">
                <Image
                  src="/images/dashboard-screenshot.png"
                  alt="Qaos Dashboard"
                  width={1920}
                  height={1080}
                  unoptimized
                  className="w-full border border-border/60 shadow-2xl"
                />
              </div>
            </div>
          </ScrollReveal>

          {/* Right callouts */}
          <div className="space-y-10">
            {callouts.filter(c => c.position.startsWith('right')).map((callout, i) => (
              <ScrollReveal key={i} direction="left" delay={i * 100 + 200}>
                <CalloutCard {...callout} align="left" />
              </ScrollReveal>
            ))}
          </div>
        </div>

        {/* Mobile: mockup on top, callouts stacked below */}
        <div className="lg:hidden space-y-10">
          <ScrollReveal>
            <div className="relative max-w-md mx-auto">
              <div className="absolute -inset-4 rounded-2xl bg-[#2d7a4f]/[0.03] blur-xl" />
              <div className="relative">
                <Image
                  src="/images/dashboard-screenshot.png"
                  alt="Qaos Dashboard"
                  width={1920}
                  height={1080}
                  unoptimized
                  className="w-full border border-border/60 shadow-xl"
                />
              </div>
            </div>
          </ScrollReveal>

          <div className="grid gap-6 sm:grid-cols-2 max-w-lg mx-auto sm:max-w-none">
            {callouts.map((callout, i) => (
              <ScrollReveal key={i} delay={i * 80}>
                <CalloutCard {...callout} align="left" />
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function CalloutCard({
  icon: Icon,
  title,
  description,
  align,
}: {
  icon: React.ElementType
  title: string
  description: string
  align: 'left' | 'right'
}) {
  return (
    <div className={`flex gap-4 ${align === 'right' ? 'lg:flex-row-reverse lg:text-right' : ''}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
