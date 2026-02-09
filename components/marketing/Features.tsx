import { Package, Users, BarChart3, Store, Bell, Smartphone } from 'lucide-react'

const features = [
  {
    icon: Package,
    title: 'Smart Inventory Tracking',
    description:
      'Real-time stock levels across all locations. Get alerts before you run low, not after.',
  },
  {
    icon: Users,
    title: 'Effortless Shift Management',
    description:
      'Create, publish, and manage schedules in seconds. Staff get instant notifications.',
  },
  {
    icon: Store,
    title: 'Multi-Location Control',
    description:
      'One dashboard for all your restaurants. See everything, manage everything, from anywhere.',
  },
  {
    icon: BarChart3,
    title: 'Actionable Analytics',
    description:
      'Understand your costs, optimize your ordering, and spot trends before they become problems.',
  },
  {
    icon: Bell,
    title: 'Smart Alerts',
    description:
      "Never miss a low-stock warning or scheduling conflict. We'll keep you in the loop.",
  },
  {
    icon: Smartphone,
    title: 'Works Everywhere',
    description:
      'Desktop, tablet, or phone. Your team can access everything they need, whenever they need it.',
  },
]

export function Features() {
  return (
    <section id="features" className="py-24 lg:py-36 scroll-mt-24">
      <div className="container mx-auto px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center mb-20">
          <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-primary/20 bg-primary/5 px-5 py-2.5 text-sm font-medium text-primary">
            Built for real restaurants
          </div>
          <h2 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl leading-tight">
            Everything you need, nothing you don&apos;t
          </h2>
          <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed">
            Powerful features designed by people who understand restaurant operations. Simple enough
            to start using today.
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 md:gap-8 grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative rounded-2xl border border-border/60 bg-card p-5 sm:p-8 lg:p-10 shadow-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30"
            >
              <div className="mb-4 sm:mb-6 inline-flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20 transition-transform duration-300 group-hover:scale-105">
                <feature.icon className="h-5 w-5 sm:h-7 sm:w-7" />
              </div>
              <h3 className="mb-2 sm:mb-4 text-base sm:text-xl font-semibold text-foreground">{feature.title}</h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
