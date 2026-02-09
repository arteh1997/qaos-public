import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon?: React.ReactNode
  className?: string
  variant?: 'default' | 'warning' | 'success' | 'danger'
}

export function StatsCard({
  title,
  value,
  description,
  icon,
  className,
  variant = 'default',
}: StatsCardProps) {
  const variantStyles = {
    default: '',
    warning: 'border-yellow-500/50 bg-yellow-500/10',
    success: 'border-green-500/50 bg-green-500/10',
    danger: 'border-red-500/50 bg-red-500/10',
  }

  return (
    <Card className={cn('group py-5 gap-4', variantStyles[variant], className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-muted-foreground group-hover:text-foreground transition-colors duration-200">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}
