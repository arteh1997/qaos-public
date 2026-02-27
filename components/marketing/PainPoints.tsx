'use client'

import { ScrollReveal } from './ScrollReveal'

export function PainPoints() {
  return (
    <section className="py-24 lg:py-36">
      <div className="container mx-auto px-6 lg:px-8">
        <ScrollReveal>
          <div className="mx-auto max-w-3xl text-center mb-20">
            <h2 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl leading-tight">
              We know what you&apos;re dealing with
            </h2>
            <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed">
              Running a business is hard enough. Your software shouldn&apos;t make it harder.
            </p>
          </div>
        </ScrollReveal>

        {/* Block 1: Waste — text left, visual right */}
        <div className="mb-16 lg:mb-24 max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-destructive/10 px-4 py-1.5 text-sm font-medium text-destructive">
                  The waste problem
                </div>
                <h3 className="mb-4 text-2xl font-bold text-foreground sm:text-3xl leading-tight">
                  Throwing away money on food waste?
                </h3>
                <p className="text-muted-foreground leading-relaxed text-lg">
                  The average restaurant wastes 5-10% of purchased food. Over-ordering because you can&apos;t
                  see what&apos;s actually in stock. Watching ingredients expire because nobody tracked the dates.
                  That&apos;s thousands of pounds going straight into the bin every month.
                </p>
              </div>
              {/* CSS waste visual */}
              <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-card">
                <div className="text-sm font-medium text-foreground mb-4">Monthly Waste Reduction</div>
                <div className="space-y-3">
                  {[
                    { label: 'Before Qaos', value: 82, color: 'bg-destructive/70' },
                    { label: 'After 1 month', value: 55, color: 'bg-[#b58a3a]' },
                    { label: 'After 3 months', value: 28, color: 'bg-[#2d7a4f]' },
                  ].map((bar, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{bar.label}</span>
                        <span className="font-medium text-foreground">£{bar.value * 20}</span>
                      </div>
                      <div className="h-3 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${bar.color} transition-all duration-700`}
                          style={{ width: `${bar.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Monthly savings</span>
                  <span className="font-semibold text-[#2d7a4f]">£1,080 saved</span>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>

        {/* Block 2: Spreadsheets — visual left, text right */}
        <div className="mb-16 lg:mb-24 max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
              {/* CSS spreadsheet → dashboard visual */}
              <div className="order-2 lg:order-1 rounded-2xl border border-border/60 bg-card p-6 shadow-card">
                <div className="grid grid-cols-2 gap-3">
                  {/* Before: messy spreadsheet look */}
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 min-w-0">
                    <div className="text-[10px] font-medium text-destructive mb-2 uppercase tracking-wider">Before</div>
                    <div className="space-y-1">
                      {[1, 2, 3, 4, 5].map(r => (
                        <div key={r} className="flex gap-1">
                          <div className="h-2 rounded-sm bg-destructive/15 flex-1" />
                          <div className="h-2 rounded-sm bg-destructive/10" style={{ width: `${30 + r * 8}%` }} />
                          <div className="h-2 rounded-sm bg-destructive/15" style={{ width: `${20 + r * 5}%` }} />
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-[9px] text-destructive/60 truncate">spreadsheet_v3_FINAL_v2.xlsx</div>
                  </div>
                  {/* After: clean dashboard */}
                  <div className="rounded-lg border border-[#2d7a4f]/20 bg-[#2d7a4f]/5 p-3 min-w-0">
                    <div className="text-[10px] font-medium text-[#2d7a4f] mb-2 uppercase tracking-wider">After</div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-[#2d7a4f]" />
                        <div className="h-2 rounded-sm bg-[#2d7a4f]/20 flex-1" />
                        <div className="text-[8px] text-[#2d7a4f] font-medium">142</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-[#b58a3a]" />
                        <div className="h-2 rounded-sm bg-[#b58a3a]/20 flex-1" />
                        <div className="text-[8px] text-[#b58a3a] font-medium">8</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-[#2d7a4f]" />
                        <div className="h-2 rounded-sm bg-[#2d7a4f]/20 flex-1" />
                        <div className="text-[8px] text-[#2d7a4f] font-medium">0</div>
                      </div>
                    </div>
                    <div className="mt-2 text-[9px] text-[#2d7a4f]/60">Live dashboard</div>
                  </div>
                </div>
              </div>

              <div className="order-1 lg:order-2">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#b58a3a]/10 px-4 py-1.5 text-sm font-medium text-[#b58a3a]">
                  The spreadsheet problem
                </div>
                <h3 className="mb-4 text-2xl font-bold text-foreground sm:text-3xl leading-tight">
                  Drowning in spreadsheets?
                </h3>
                <p className="text-muted-foreground leading-relaxed text-lg">
                  Your managers are spending 10+ hours a week maintaining stock spreadsheets that are outdated
                  the moment they&apos;re saved. Copying numbers between tabs, emailing files back and forth,
                  and praying nobody overwrites the formulas.
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>

        {/* Secondary pain points — compact cards */}
        <div className="grid gap-6 sm:grid-cols-2 max-w-4xl mx-auto">
          <ScrollReveal delay={0}>
            <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-card">
              <h3 className="mb-3 text-xl font-semibold text-foreground">Stock nightmares</h3>
              <p className="text-muted-foreground leading-relaxed">
                Running out of key ingredients during rush hour. Over-ordering and watching food spoil. It&apos;s
                costing you thousands — and your reputation.
              </p>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-card">
              <h3 className="mb-3 text-xl font-semibold text-foreground">Shift chaos</h3>
              <p className="text-muted-foreground leading-relaxed">
                Last-minute no-shows, scheduling conflicts, and staff confusion. Your team deserves better
                than WhatsApp group chaos.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
