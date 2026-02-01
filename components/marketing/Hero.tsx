import { Button } from '@/components/ui/button'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-background">
      {/* Background decoration - more subtle */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[800px] w-[800px] rounded-full bg-primary/[0.03] blur-3xl" />
        <div className="absolute right-0 top-1/3 h-[500px] w-[500px] rounded-full bg-primary/[0.02] blur-3xl" />
      </div>

      <div className="container mx-auto px-6 lg:px-8">
        <div className="mx-auto max-w-4xl py-28 lg:py-44 text-center">
          {/* Badge */}
          <div className="mb-10 inline-flex items-center gap-2.5 rounded-full border border-primary/20 bg-primary/5 px-5 py-2.5 text-sm font-medium text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
            </span>
            Built for serious restaurant operators
          </div>

          {/* Headline */}
          <h1 className="mb-8 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl xl:text-7xl leading-[1.1]">
            Stop losing money on
            <span className="text-primary block sm:inline"> inventory chaos</span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mb-14 max-w-2xl text-lg text-muted-foreground lg:text-xl leading-relaxed">
            Finally, restaurant management software that actually works.
            Track inventory, manage shifts, and control costs across all your locations
            <strong className="text-foreground font-medium"> from one powerful dashboard.</strong>
          </p>

          {/* CTA Buttons */}
          <div className="mb-20 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5">
            <Button asChild size="lg" className="text-base sm:text-lg px-8 py-6 h-auto shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all duration-300">
              <Link href="/login?signup=true">
                Start 14-Day Free Trial
                <ArrowRight className="ml-2.5 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-base sm:text-lg px-8 py-6 h-auto hover:bg-accent/50 transition-all duration-300">
              <a href="#features">See How It Works</a>
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-primary/80" />
              <span>14-day free trial</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-primary/80" />
              <span>Setup in 5 minutes</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-primary/80" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
