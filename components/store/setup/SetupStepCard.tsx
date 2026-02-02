'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SetupStep } from '@/types/setup'
import { Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SetupStepCardProps {
  step: SetupStep
  isExpanded: boolean
  onToggle: () => void
  children?: React.ReactNode
}

export function SetupStepCard({
  step,
  isExpanded,
  onToggle,
  children,
}: SetupStepCardProps) {
  const Icon = step.icon

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        step.isComplete && 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20',
        isExpanded && 'ring-2 ring-primary/20'
      )}
    >
      <CardContent className="p-0">
        <button
          type="button"
          onClick={onToggle}
          className="w-full p-4 flex items-center gap-4 text-left hover:bg-muted/50 transition-colors rounded-t-2xl"
        >
          {/* Icon with completion status */}
          <div
            className={cn(
              'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
              step.isComplete
                ? 'bg-green-500 text-white'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {step.isComplete ? (
              <Check className="h-5 w-5" />
            ) : (
              <Icon className="h-5 w-5" />
            )}
          </div>

          {/* Title and description */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm sm:text-base">{step.title}</h3>
              {step.isRequired && !step.isComplete && (
                <Badge variant="secondary" className="text-xs">
                  Required
                </Badge>
              )}
              {step.isComplete && (
                <Badge variant="default" className="text-xs bg-green-500">
                  Complete
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">
              {step.description}
            </p>
          </div>

          {/* Expand/collapse indicator */}
          <ChevronRight
            className={cn(
              'h-5 w-5 text-muted-foreground transition-transform',
              isExpanded && 'rotate-90'
            )}
          />
        </button>

        {/* Expanded content */}
        {isExpanded && children && (
          <div className="px-4 pb-4 pt-2 border-t">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
