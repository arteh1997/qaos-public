"use client";

import { Button } from "@/components/ui/button";
import { MarketingHeader } from "@/components/marketing/Header";
import { Footer } from "@/components/marketing/Footer";
import { ScrollReveal } from "@/components/marketing/ScrollReveal";
import {
  Check,
  ArrowRight,
  TrendingDown,
  Clock,
  AlertTriangle,
  PiggyBank,
} from "lucide-react";
import Link from "next/link";
import { useCurrencyDetection } from "@/hooks/useCurrencyDetection";
import {
  VOLUME_DISCOUNTS,
  calculateMonthlyBill,
} from "@/lib/stripe/billing-config";

const features = [
  "Real-time stock tracking",
  "Shift scheduling & timetables",
  "Multi-location dashboard",
  "Low stock alerts & email notifications",
  "Reports & analytics",
  "Recipe costing & menu analysis",
  "Supplier management & purchase orders",
  "POS integration (20+ providers)",
  "AI-powered forecasting",
  "Audit trail",
  "Data export (CSV)",
  "Mobile PWA with offline support",
  "Barcode scanning",
  "Unlimited inventory items",
  "Unlimited team members",
  "Priority support",
];

const savings = [
  {
    icon: TrendingDown,
    title: "Reduce Food Waste by 15-25%",
    description:
      "Better stock visibility and PAR level alerts help prevent over-ordering and spoilage.",
    savingMultiplier: [0.67, 1.67],
  },
  {
    icon: Clock,
    title: "Save 10+ Hours Per Week",
    description:
      "Stop wrestling with spreadsheets. Automated stock counts and reports free up your managers.",
    savingMultiplier: [1.34, 2.01],
  },
  {
    icon: AlertTriangle,
    title: "Prevent Costly Stockouts",
    description:
      "Never lose a sale because you ran out of a key ingredient. Low stock alerts keep you prepared.",
    savingMultiplier: [1.0, 2.68],
  },
  {
    icon: PiggyBank,
    title: "Smarter Ordering Decisions",
    description:
      "Historical data and trends help you order the right amount at the right time.",
    savingMultiplier: [0.5, 1.34],
  },
];

export default function PricingPage() {
  const { tier } = useCurrencyDetection();

  const displayPrice = (tier.amount / 100).toLocaleString(tier.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const formatSaving = (multiplier: number) => {
    const value = Math.round((tier.amount / 100) * multiplier);
    return `${tier.symbol}${value.toLocaleString(tier.locale)}`;
  };

  return (
    <>
      <MarketingHeader />
      <main className="pt-20">
        {/* Hero Section */}
        <section className="py-20 lg:py-28 bg-background">
          <div className="container mx-auto px-6 lg:px-8">
            <ScrollReveal>
              <div className="mx-auto max-w-3xl text-center">
                <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-tight">
                  Software that pays for itself
                </h1>
                <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed">
                  Qaos isn&apos;t an expense — it&apos;s an investment that
                  saves you multiples of its cost every single month.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Value Justification Section */}
        <section className="py-20 lg:py-28 bg-muted/20">
          <div className="container mx-auto px-6 lg:px-8">
            <ScrollReveal>
              <div className="mx-auto max-w-3xl text-center mb-16">
                <h2 className="mb-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  How Qaos saves you money
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Estimated savings based on industry waste reduction and time
                  savings
                </p>
              </div>
            </ScrollReveal>

            <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
              {savings.map((item, index) => (
                <ScrollReveal key={index} delay={index * 80}>
                  <div className="rounded-2xl border border-border/60 bg-card p-6 lg:p-8 shadow-card">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary flex-shrink-0">
                        <item.icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground mb-2">
                          {item.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          {item.description}
                        </p>
                        <p className="text-sm font-medium text-primary">
                          Typical savings:{" "}
                          {formatSaving(item.savingMultiplier[0])} -{" "}
                          {formatSaving(item.savingMultiplier[1])}/month
                        </p>
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>

            <ScrollReveal delay={350}>
              <div className="mt-12 text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 py-2.5 text-sm font-medium text-primary">
                  <PiggyBank className="h-4 w-4" />
                  Average total savings: {formatSaving(3.5)} -{" "}
                  {formatSaving(7.7)}/month per location
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="py-20 lg:py-28 bg-background">
          <div className="container mx-auto px-6 lg:px-8">
            <ScrollReveal>
              <div className="mx-auto max-w-3xl text-center mb-16">
                <h2 className="mb-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Simple, transparent pricing
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  One plan. Everything included. Pay per location.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <div className="mx-auto max-w-xl">
                {/* Glassmorphism Pricing Card */}
                <div className="relative rounded-3xl border-2 border-primary/30 p-10 lg:p-12 shadow-xl glass gradient-border">
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25">
                      1-Month Free Trial
                    </span>
                  </div>

                  <div className="text-center mb-10 pt-4">
                    <h3 className="text-2xl font-bold text-foreground mb-3">
                      Professional
                    </h3>
                    <p className="text-muted-foreground">
                      For serious operators
                    </p>
                  </div>

                  <div className="text-center mb-10">
                    <span className="text-5xl sm:text-6xl font-bold text-foreground tracking-tight">
                      {tier.symbol}
                      {displayPrice}
                    </span>
                    <span className="text-muted-foreground ml-2 text-lg">
                      / store / month
                    </span>
                  </div>

                  <ul className="mb-10 space-y-3">
                    {features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-3">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-sm text-foreground">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    className="w-full py-7 text-lg h-auto shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all duration-300"
                  >
                    <Link href="/login?signup=true">
                      Start Free Trial
                      <ArrowRight className="ml-2.5 h-5 w-5" />
                    </Link>
                  </Button>

                  <p className="mt-6 text-center text-sm text-muted-foreground">
                    1-month free trial. Cancel anytime.
                  </p>
                </div>

                {/* Volume Discounts */}
                <ScrollReveal delay={200}>
                  <div className="mt-10 rounded-2xl border border-border/60 bg-card p-8 shadow-card">
                    <h3 className="text-lg font-semibold text-foreground mb-2 text-center">
                      Multi-location discount
                    </h3>
                    <p className="text-sm text-muted-foreground text-center mb-6">
                      The more stores you add, the less you pay. Discount
                      applies to your entire bill.
                    </p>

                    {/* Discount table */}
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-3">
                        <span className="text-sm text-muted-foreground">
                          1-4 stores
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {tier.symbol}
                          {displayPrice}/store/month — full price
                        </span>
                      </div>
                      {VOLUME_DISCOUNTS.map((vd, i) => {
                        const bill = calculateMonthlyBill(
                          vd.minStores,
                          tier.currency.toUpperCase(),
                        );
                        const totalDisplay = (bill.total / 100).toLocaleString(
                          tier.locale,
                          {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          },
                        );
                        const savedDisplay = (
                          bill.discount / 100
                        ).toLocaleString(tier.locale, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        });
                        const effectivePerStore = (
                          bill.total /
                          vd.minStores /
                          100
                        ).toLocaleString(tier.locale, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        });
                        return (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-xl bg-primary/5 border border-primary/20 px-4 py-3"
                          >
                            <div>
                              <span className="text-sm font-medium text-foreground">
                                {vd.minStores}+ stores
                              </span>
                              <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                {vd.discountPercent}% off
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-foreground">
                                {tier.symbol}
                                {totalDisplay}/mo total
                              </div>
                              <div className="text-xs text-primary">
                                {tier.symbol}
                                {effectivePerStore}/store · save {tier.symbol}
                                {savedDisplay}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                      Example: 10 stores at {tier.symbol}
                      {displayPrice} = {tier.symbol}
                      {((tier.amount / 100) * 10).toLocaleString(tier.locale, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                      . With 20% discount you pay {tier.symbol}
                      {(
                        calculateMonthlyBill(10, tier.currency.toUpperCase())
                          .total / 100
                      ).toLocaleString(tier.locale, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                      /month.
                    </p>
                  </div>
                </ScrollReveal>

                {/* ROI Calculator Summary */}
                <ScrollReveal delay={300}>
                  <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center">
                    <p className="text-foreground font-semibold mb-2">
                      Your investment vs your return
                    </p>
                    <div className="flex items-center justify-center gap-4 text-lg">
                      <span className="text-muted-foreground">
                        {tier.symbol}
                        {displayPrice}/month
                      </span>
                      <ArrowRight className="h-5 w-5 text-primary" />
                      <span className="text-primary font-bold">
                        3-7x return in savings
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-3">
                      That&apos;s a {formatSaving(3.5)} - {formatSaving(7.7)}{" "}
                      return on your investment
                    </p>
                  </div>
                </ScrollReveal>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20 lg:py-28 bg-muted/20">
          <div className="container mx-auto px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
              <ScrollReveal>
                <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl text-center mb-12">
                  Common questions
                </h2>
              </ScrollReveal>

              <div className="divide-y divide-border/60">
                {[
                  {
                    q: "How does the free trial work?",
                    a: `You get full access to all features for 30 days, no credit card required. At the end of your trial, subscribe to keep your data and continue using Qaos.`,
                  },
                  {
                    q: "What happens to my data if I cancel?",
                    a: "Your data is yours. Export everything at any time. If you cancel, we keep your data for 30 days in case you change your mind.",
                  },
                  {
                    q: "Can I add more locations later?",
                    a: `Yes! Add new locations at any time. Each location is ${tier.symbol}${displayPrice}/month — and the more you add, the less you pay. 5+ stores get 10% off your entire bill, 10+ stores get 20% off.`,
                  },
                  {
                    q: "Is there a contract or commitment?",
                    a: "No long-term contracts. Pay month-to-month and cancel anytime. We earn your business every month.",
                  },
                ].map((faq, i) => (
                  <ScrollReveal key={i} delay={i * 60}>
                    <details className="group py-6">
                      <summary className="flex cursor-pointer items-center justify-between text-left text-lg font-medium text-foreground transition-colors hover:text-primary [&::-webkit-details-marker]:hidden">
                        {faq.q}
                        <span className="ml-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45">
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="none"
                          >
                            <path
                              d="M10 4v12M4 10h12"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
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
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 lg:py-28 bg-background">
          <div className="container mx-auto px-6 lg:px-8">
            <ScrollReveal>
              <div className="mx-auto max-w-3xl text-center">
                <h2 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  Your business deserves better
                </h2>
                <p className="mb-10 text-lg text-muted-foreground">
                  Start saving thousands every month with better inventory
                  management.
                </p>
                <Button
                  asChild
                  size="lg"
                  className="text-lg px-10 py-7 h-auto shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all duration-300"
                >
                  <Link href="/login?signup=true">
                    Start Your Free Trial
                    <ArrowRight className="ml-2.5 h-5 w-5" />
                  </Link>
                </Button>
                <p className="mt-6 text-sm text-muted-foreground">
                  1-month free trial. Cancel anytime.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
