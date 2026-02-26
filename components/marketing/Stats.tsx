'use client'

import { AnimatedCounter } from './AnimatedCounter'
import { ScrollReveal } from './ScrollReveal'

const stats = [
  { value: 4200, suffix: '+', label: 'Stock Counts Completed' },
  { value: 50000, suffix: '+', label: 'Items Tracked' },
  { prefix: '£', value: 2, suffix: 'M+', label: 'Waste Prevented' },
]

export function Stats() {
  return (
    <section className="bg-[#2d2a26] py-20 lg:py-28">
      <div className="container mx-auto px-6 lg:px-8">
        <ScrollReveal direction="none">
          <div className="grid gap-12 text-center sm:grid-cols-3 sm:gap-8 max-w-4xl mx-auto">
            {stats.map((stat, i) => (
              <div key={i}>
                <AnimatedCounter
                  target={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  className="text-4xl font-bold text-[#faf8f5] sm:text-5xl lg:text-6xl"
                />
                <p className="mt-3 text-sm text-[#8a8279] sm:text-base tracking-wide uppercase">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
