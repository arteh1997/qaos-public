'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SetupStep } from '@/types/setup'
import { Check, ChevronRight, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SetupStepCardProps {
  step: SetupStep
  isExpanded: boolean
  isLocked?: boolean
  onToggle: () => void
  children?: React.ReactNode
}

export function SetupStepCard({
  step,
  isExpanded,
  isLocked = false,
  onToggle,
  children,
}: SetupStepCardProps) {
  const Icon = step.icon

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        step.isComplete && 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20',
        isLocked && 'opacity-50',
        isExpanded && !isLocked && 'ring-2 ring-primary/20'
      )}
    >
      <CardContent className="p-0">
        <button
          type="button"
          onClick={onToggle}
          disabled={isLocked}
          className={cn(
            'w-full p-3 sm:p-4 flex items-center gap-3 sm:gap-4 text-left transition-colors',
            isLocked ? 'cursor-not-allowed' : 'hover:bg-muted/50',
            isExpanded ? 'rounded-t-lg' : 'rounded-lg'
          )}
        >
          {/* Icon with completion/locked status */}
          <div
            className={cn(
              'flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center',
              step.isComplete
                ? 'bg-green-500 text-white'
                : isLocked
                ? 'bg-muted/50 text-muted-foreground/50'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {step.isComplete ? (
              <Check className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : isLocked ? (
              <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            ) : (
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </div>

          {/* Title and description */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              <h3 className="font-medium text-sm sm:text-base">{step.title}</h3>
              {step.isComplete && (
                <Badge variant="default" className="text-[10px] sm:text-xs px-1.5 py-0 bg-green-500">
                  Complete
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2">
              {isLocked ? 'Complete the required steps above first' : step.description}
            </p>
          </div>

          {/* Expand/collapse indicator */}
          {!isLocked && (
            <ChevronRight
              className={cn(
                'h-5 w-5 text-muted-foreground transition-transform',
                isExpanded && 'rotate-90'
              )}
            />
          )}
        </button>

        {/* Expanded content */}
        {isExpanded && !isLocked && children && (
          <div className="px-3 sm:px-4 pb-4 pt-2 border-t">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
