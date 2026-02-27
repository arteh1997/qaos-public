'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-background pt-24 lg:pt-28">
      {/* Layered background */}
      <div className="absolute inset-0 -z-10">
        {/* Dot grid pattern */}
        <div className="absolute inset-0 dot-grid opacity-40" />
        {/* Green accent glow — top left */}
        <div className="absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full bg-[#2d7a4f]/[0.03] blur-3xl" />
        {/* Warm gold glow — bottom right */}
        <div className="absolute -right-32 bottom-0 h-[500px] w-[500px] rounded-full bg-[#b58a3a]/[0.02] blur-3xl" />
      </div>

      <div className="container mx-auto px-6 lg:px-8">
        {/* Centred copy */}
        <div className="mx-auto max-w-4xl text-center pb-12 lg:pb-16">
          {/*
            One headline, one statement. The colors tell the story:
            - "chaos"  = #b58a3a (warm gold — the problem)
            - "quiet"  = #2d7a4f (calm green — the solution)
            - "Qaos"   = Q(#2d7a4f) + aos(#b58a3a) — the brand is the fusion
          */}
          <h1 className="mb-8 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl xl:text-7xl leading-[1.12] animate-fade-in-up">
            Make the{' '}
            <span className="text-[#b58a3a]">chaos</span>{' '}
            in your business{' '}
            <span className="text-[#2d7a4f]">quiet</span>{' '}
            with{' '}
            <span className="whitespace-nowrap">
              <span className="text-[#2d7a4f]">Q</span>
              <span className="text-[#b58a3a]">aos</span>
            </span>.
          </h1>

          {/* Subheadline — generic, whole-operation */}
          <p className="mb-10 mx-auto max-w-xl text-lg text-muted-foreground lg:text-xl leading-relaxed animate-fade-in-up stagger-4">
            One platform for your entire operation. Inventory, team, suppliers, and costs{' '}
            <strong className="text-foreground font-medium">all from one powerful dashboard.</strong>
          </p>

          {/* CTA Buttons */}
          <div className="mb-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-5 animate-fade-in-up stagger-5">
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto text-base sm:text-lg px-8 py-6 h-auto shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all duration-300 animate-glow-pulse"
            >
              <Link href="/login?signup=true">
                Start 1-Month Free Trial
                <ArrowRight className="ml-2.5 h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full sm:w-auto text-base sm:text-lg px-8 py-6 h-auto hover:bg-accent/50 transition-all duration-300"
            >
              <a href="#features">See How It Works</a>
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#2d7a4f]" />
              <span>1-month free trial</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#2d7a4f]" />
              <span>Setup in 5 minutes</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#2d7a4f]" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>

        {/* Dashboard screenshot — large, below copy */}
        <div className="relative pb-20 lg:pb-28">
          <div className="absolute -inset-8 rounded-3xl bg-[#2d7a4f]/[0.04] blur-2xl" />
          <div className="relative mx-auto">
            <Image
              src="/images/dashboard-screenshot.png"
              alt="Qaos Dashboard — inventory tracking, stock alerts, and daily checklists"
              width={5120}
              height={2880}
              priority
              unoptimized
              className="w-full border border-border/60 shadow-2xl"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
