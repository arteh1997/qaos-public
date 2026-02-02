'use client'

import { useState } from 'react'
import { Store } from '@/types'
import { StoreSetupStatus, SetupStepId } from '@/types/setup'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { SetupStepCard } from './SetupStepCard'
import { InventorySetupStep } from './steps/InventorySetupStep'
import { HoursSetupStep } from './steps/HoursSetupStep'
import { TeamSetupStep } from './steps/TeamSetupStep'
import { Store as StoreIcon, CheckCircle2, ArrowRight } from 'lucide-react'

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

  const requiredComplete = status.steps.filter(s => s.isRequired && s.isComplete).length
  const allRequiredComplete = requiredComplete === status.requiredCount

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Welcome Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <StoreIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Welcome to {store.name}!</CardTitle>
              <CardDescription>
                Let&apos;s get your store set up and ready to manage inventory
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Setup Progress</span>
              <span className="font-medium">{status.completedCount} of {status.totalCount} steps</span>
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

      {/* Continue Button */}
      <Card className={allRequiredComplete ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : ''}>
        <CardContent className="pt-6">
          {allRequiredComplete ? (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Required setup complete!</span>
              </div>
              <div className="flex-1" />
              <Button onClick={onRefresh} className="gap-2">
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Complete the required step above to continue to your store dashboard
              </p>
              <Button variant="outline" onClick={onRefresh} className="gap-2">
                <ArrowRight className="h-4 w-4" />
                Skip for Now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
