import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

export function CTA() {
  return (
    <section className="py-24 lg:py-36">
      <div className="container mx-auto px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem] bg-primary px-8 py-20 text-center lg:px-20 lg:py-28">
          {/* Background decoration */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute left-0 top-0 h-[400px] w-[400px] rounded-full bg-white/10 blur-3xl" />
            <div className="absolute right-0 bottom-0 h-[500px] w-[500px] rounded-full bg-white/5 blur-3xl" />
          </div>

          <h2 className="mb-6 text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl lg:text-5xl xl:text-6xl leading-tight">
            Ready to take control?
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-lg lg:text-xl text-primary-foreground/80 leading-relaxed">
            Join restaurant operators who&apos;ve stopped losing money to inventory chaos. Start your
            free trial today.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="text-base sm:text-lg px-10 py-7 h-auto shadow-xl hover:shadow-2xl transition-all duration-300"
            >
              <Link href="/login?signup=true">
                Start 1-Month Free Trial
                <ArrowRight className="ml-2.5 h-5 w-5" />
              </Link>
            </Button>
          </div>
          <p className="mt-8 text-sm text-primary-foreground/60">
            1-month free trial. Setup in 5 minutes.
          </p>
        </div>
      </div>
    </section>
  )
}
