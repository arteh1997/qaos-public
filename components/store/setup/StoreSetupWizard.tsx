'use client'

import { useState } from 'react'
import { Store } from '@/types'
import { StoreSetupStatus, SetupStepId } from '@/types/setup'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { SetupStepCard } from './SetupStepCard'
import { InventorySetupStep } from './steps/InventorySetupStep'
import { HoursSetupStep } from './steps/HoursSetupStep'
import { TeamSetupStep } from './steps/TeamSetupStep'
import { Store as StoreIcon } from 'lucide-react'

interface StoreSetupWizardProps {
  store: Store
  status: StoreSetupStatus
  onRefresh: () => void
}

export function StoreSetupWizard({ store, status, onRefresh }: StoreSetupWizardProps) {
  const [expandedStep, setExpandedStep] = useState<SetupStepId | null>(
    // Auto-expand the first incomplete required step
    status.steps.find(s => s.isRequired && !s.isComplete)?.id ?? null
  )

  const handleToggleStep = (stepId: SetupStepId) => {
    setExpandedStep(prev => (prev === stepId ? null : stepId))
  }

  const handleStepComplete = () => {
    // Refresh status to update completion states
    onRefresh()
  }

  const progressPercent = status.totalCount > 0
    ? Math.round((status.completedCount / status.totalCount) * 100)
    : 0

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Welcome Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-primary/10 flex-shrink-0">
              <StoreIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg sm:text-xl break-words">Welcome to {store.name}!</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Let&apos;s get your store set up and ready to manage inventory
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
              <span className="text-muted-foreground">Setup Progress</span>
              <span className="font-medium flex-shrink-0">{status.completedCount} of {status.totalCount} steps</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Setup Steps */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Setup Steps</h2>

        {status.steps.map((step) => (
          <SetupStepCard
            key={step.id}
            step={step}
            isExpanded={expandedStep === step.id}
            onToggle={() => handleToggleStep(step.id)}
          >
            {step.id === 'inventory' && (
              <InventorySetupStep onComplete={handleStepComplete} />
            )}
            {step.id === 'hours' && (
              <HoursSetupStep store={store} onComplete={handleStepComplete} />
            )}
            {step.id === 'team' && (
              <TeamSetupStep store={store} onComplete={handleStepComplete} />
            )}
          </SetupStepCard>
        ))}
      </div>

    </div>
  )
}
