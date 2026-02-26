'use client'

import { ScrollReveal } from './ScrollReveal'

const faqs = [
  {
    q: 'How does the free trial work?',
    a: 'You get full access to every feature for 30 days, no credit card required. If you decide RestaurantOS is right for you, subscribe to keep your data and continue using it. If not, no charge.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. There are no contracts or cancellation fees. You can cancel your subscription at any time from your billing settings, and you\'ll retain access until the end of your billing period.',
  },
  {
    q: 'Does it work with multiple locations?',
    a: 'Absolutely. You can manage as many stores as you need from one account. Each store has its own inventory, team, and settings, but you get a unified view across all locations.',
  },
  {
    q: 'What POS systems do you integrate with?',
    a: 'We integrate with Square, Toast, Clover, Lightspeed, and 15+ other POS systems. When a sale happens, inventory deducts automatically. We also offer a custom webhook API for any POS.',
  },
  {
    q: 'How quickly can my team get started?',
    a: 'Most restaurants are up and running in under 15 minutes. Import your inventory via CSV, invite your team, and you\'re live. No training needed — if your staff can use a phone, they can use RestaurantOS.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. We use bank-grade encryption (TLS 1.3), row-level security for multi-tenant data isolation, and SOC 2-aligned infrastructure. Your data is yours — we never sell or share it.',
  },
]

export function FAQ() {
  return (
    <section className="py-24 lg:py-36">
      <div className="container mx-auto px-6 lg:px-8">
        <ScrollReveal>
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl leading-tight">
              Frequently asked questions
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Everything you need to know before getting started.
            </p>
          </div>
        </ScrollReveal>

        <div className="mx-auto max-w-3xl divide-y divide-border/60">
          {faqs.map((faq, i) => (
            <ScrollReveal key={i} delay={i * 60}>
              <details className="group py-6">
                <summary className="flex cursor-pointer items-center justify-between text-left text-lg font-medium text-foreground transition-colors hover:text-primary [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <span className="ml-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                </summary>
                <div className="pt-4 text-muted-foreground leading-relaxed">
                  {faq.a}
                </div>
              </details>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
