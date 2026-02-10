import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface CategoryBadgeProps {
  name: string
  color?: string | null
  className?: string
  variant?: 'default' | 'outline' | 'secondary'
}

export function CategoryBadge({ name, color, className, variant = 'default' }: CategoryBadgeProps) {
  return (
    <Badge
      variant={variant}
      className={cn('text-xs font-medium', className)}
      style={
        color
          ? {
              backgroundColor: variant === 'outline' ? 'transparent' : color,
              borderColor: color,
              color: variant === 'outline' ? color : getContrastColor(color),
            }
          : undefined
      }
    >
      {name}
    </Badge>
  )
}

// Calculate contrast color for readability
function getContrastColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '')

  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  // Return black or white based on luminance
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}
