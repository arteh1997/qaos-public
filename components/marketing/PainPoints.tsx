import { XCircle, DollarSign, Clock, AlertTriangle } from 'lucide-react'

const painPoints = [
  {
    icon: DollarSign,
    title: 'Overpriced Software',
    description:
      "Enterprise tools charging thousands per month for features you'll never use. That's money that should be going back into your business.",
  },
  {
    icon: Clock,
    title: 'Wasted Hours',
    description:
      "Still using spreadsheets and paper? Your managers are spending 10+ hours a week on tasks that should take minutes.",
  },
  {
    icon: AlertTriangle,
    title: 'Stock Nightmares',
    description:
      "Running out of key ingredients during rush hour. Over-ordering and watching food spoil. It's costing you thousands.",
  },
  {
    icon: XCircle,
    title: 'Shift Chaos',
    description:
      "Last-minute no-shows, scheduling conflicts, and staff confusion. Your team deserves better than WhatsApp group chaos.",
  },
]

export function PainPoints() {
  return (
    <section className="bg-muted/20 py-24 lg:py-36">
      <div className="container mx-auto px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center mb-20">
          <h2 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl leading-tight">
            We know what you&apos;re dealing with
          </h2>
          <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed">
            Running a restaurant is hard enough. Your software shouldn&apos;t make it harder.
          </p>
        </div>

        <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto">
          {painPoints.map((point, index) => (
            <div
              key={index}
              className="group rounded-2xl border border-border/60 bg-card p-8 shadow-sm transition-all duration-300 hover:shadow-lg hover:shadow-destructive/5 hover:-translate-y-1 hover:border-destructive/20"
            >
              <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-destructive/10 text-destructive transition-colors duration-300 group-hover:bg-destructive/15">
                <point.icon className="h-7 w-7" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-foreground">{point.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{point.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
