'use client'

import { useState } from 'react'
import {
  Package,
  Users,
  BarChart3,
  Store,
  Bell,
  Smartphone,
  Trash2,
  Shield,
  UtensilsCrossed,
  Truck,
  Clock,
  FileText,
  Plug,
  PoundSterling,
  ScanLine,
  Activity,
  Brain,
  PackageCheck,
  ChevronDown,
} from 'lucide-react'
import { ScrollReveal } from './ScrollReveal'
import { Button } from '@/components/ui/button'

const features = [
  // Top 8 — shown by default
  {
    icon: Package,
    title: 'Inventory Tracking',
    description:
      'Real-time stock levels across all locations. Barcode scanning, batch updates, and automatic low-stock detection.',
  },
  {
    icon: PackageCheck,
    title: 'Stock Reception',
    description:
      'Log deliveries as they arrive. Match against purchase orders and track supplier reliability.',
  },
  {
    icon: Trash2,
    title: 'Waste Tracking',
    description:
      'Log waste by reason, analyse trends, and get actionable insights to reduce waste and save money.',
  },
  {
    icon: Shield,
    title: 'Food Safety (HACCP)',
    description:
      'Digital temperature checks, corrective actions, and compliance logs. Stay audit-ready at all times.',
  },
  {
    icon: UtensilsCrossed,
    title: 'Recipe Costing & Menu Analysis',
    description:
      'Calculate exact cost per dish. Analyse margins and identify your most and least profitable items.',
  },
  {
    icon: Truck,
    title: 'Supplier Management',
    description:
      'Manage suppliers, create and track purchase orders from draft to delivery. Compare pricing across vendors.',
  },
  {
    icon: FileText,
    title: 'Reports & Analytics',
    description:
      'Daily summaries, low stock reports, forecasting, and benchmark comparisons across all your locations.',
  },
  {
    icon: Store,
    title: 'Multi-Location Dashboard',
    description:
      'One dashboard for all your locations. Compare performance, benchmark sites, and manage from anywhere.',
  },
  // Remaining 8 — shown on expand
  {
    icon: ScanLine,
    title: 'Invoice Scanning',
    description:
      'Scan supplier invoices to automatically match deliveries and keep your costs accurate.',
  },
  {
    icon: Clock,
    title: 'Shift Scheduling',
    description:
      'Create, publish, and manage schedules. Staff get instant notifications and can clock in/out from their phone.',
  },
  {
    icon: PoundSterling,
    title: 'Payroll',
    description:
      'Track hours, calculate pay, and export payroll data. Integrated with your shift schedules.',
  },
  {
    icon: Brain,
    title: 'AI-Powered Forecasting',
    description:
      'Predict demand using historical data with trend detection and day-of-week seasonality analysis.',
  },
  {
    icon: Bell,
    title: 'Smart Alerts',
    description:
      'Customisable email alerts for low stock, missing counts, scheduling conflicts, and more.',
  },
  {
    icon: Plug,
    title: 'POS Integration',
    description:
      'Connect Square, Toast, Clover, Lightspeed, and 15+ more. Auto-deduct inventory on every sale.',
  },
  {
    icon: Smartphone,
    title: 'Mobile PWA & Offline',
    description:
      'Full mobile experience — scan barcodes, count stock, log waste. Works even without internet.',
  },
  {
    icon: Activity,
    title: 'Activity Log & Audit Trail',
    description:
      'Complete history of every action. Know who did what, when, and where across your business.',
  },
]

const INITIAL_COUNT = 8

export function Features() {
  const [showAll, setShowAll] = useState(false)
  const visibleFeatures = showAll ? features : features.slice(0, INITIAL_COUNT)

  return (
    <section id="features" className="py-24 lg:py-36 scroll-mt-24">
      <div className="container mx-auto px-6 lg:px-8">
        <ScrollReveal>
          <div className="mx-auto max-w-3xl text-center mb-16 lg:mb-20">
            <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-primary/20 bg-primary/5 px-5 py-2.5 text-sm font-medium text-primary">
              Built for real operations
            </div>
            <h2 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl leading-tight">
              Everything you need, nothing you don&apos;t
            </h2>
            <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed">
              Powerful features designed by people who understand operations.
            </p>
          </div>
        </ScrollReveal>

        {/* Consistent card grid */}
        <div className="max-w-6xl mx-auto grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleFeatures.map((feature, index) => (
            <ScrollReveal key={index} delay={index * 50}>
              <div className="group rounded-2xl border border-border/60 bg-card p-6 shadow-card hover:shadow-lg hover:border-primary/30 transition-all duration-300 h-full">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Show all / Show less toggle */}
        {features.length > INITIAL_COUNT && (
          <div className="mt-8 text-center">
            <Button
              variant="outline"
              onClick={() => setShowAll(!showAll)}
              className="gap-2"
            >
              {showAll ? 'Show less' : `Show all ${features.length} features`}
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showAll ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
