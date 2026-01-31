'use client'

import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
    icon?: LucideIcon
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  className?: string
  children?: ReactNode
}

/**
 * Empty state component for displaying when no data is available
 * Provides helpful messaging and call-to-action buttons
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>

      {(action || secondaryAction || children) && (
        <div className="flex flex-col sm:flex-row gap-2">
          {action && (
            <Button onClick={action.onClick}>
              {action.icon && <action.icon className="mr-2 h-4 w-4" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * Table-specific empty state that spans all columns
 */
interface TableEmptyStateProps extends Omit<EmptyStateProps, 'className'> {
  colSpan: number
}

export function TableEmptyState({ colSpan, ...props }: TableEmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <EmptyState {...props} className="py-8" />
      </td>
    </tr>
  )
}
