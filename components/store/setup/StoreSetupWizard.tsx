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
import { SuppliersSetupStep } from './steps/SuppliersSetupStep'
import { MenuSetupStep } from './steps/MenuSetupStep'
import { Store as StoreIcon } from 'lucide-react'

interface StoreSetupWizardProps {
  store: Store
  status: StoreSetupStatus
  onRefresh: () => void
}

// Step dependencies — a step is locked until ALL its dependencies are complete.
// inventory, hours, suppliers: no deps (always unlocked)
// menu: needs inventory (can't cost menu items without stock items)
// team: needs everything else done (invite staff last)
const STEP_DEPS: Record<SetupStepId, SetupStepId[]> = {
  inventory: [],
  hours: [],
  suppliers: [],
  menu: ['inventory'],
  team: ['inventory', 'hours', 'suppliers', 'menu'],
}

export function StoreSetupWizard({ store, status, onRefresh }: StoreSetupWizardProps) {
  const [expandedStep, setExpandedStep] = useState<SetupStepId | null>(
    // Auto-expand the first incomplete step
    status.steps.find(s => !s.isComplete)?.id ?? null
  )

  const isStepLocked = (stepId: SetupStepId): boolean => {
    const deps = STEP_DEPS[stepId]
    if (deps.length === 0) return false
    return deps.some(depId => {
      const depStep = status.steps.find(s => s.id === depId)
      return depStep && !depStep.isComplete
    })
  }

  const handleToggleStep = (stepId: SetupStepId) => {
    if (isStepLocked(stepId)) return
    setExpandedStep(prev => (prev === stepId ? null : stepId))
  }

  const handleStepComplete = () => {
    // Refresh status to update completion states
    onRefresh()
    // Auto-expand the next incomplete step after a brief delay for state to update
    setTimeout(() => {
      const nextIncomplete = status.steps.find(s => !s.isComplete)
      if (nextIncomplete) {
        setExpandedStep(nextIncomplete.id)
      }
    }, 500)
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

        {status.steps.map((step) => {
          const locked = isStepLocked(step.id)
          return (
            <SetupStepCard
              key={step.id}
              step={step}
              isExpanded={expandedStep === step.id}
              isLocked={locked}
              onToggle={() => handleToggleStep(step.id)}
            >
              {step.id === 'inventory' && (
                <InventorySetupStep onComplete={handleStepComplete} />
              )}
              {step.id === 'hours' && (
                <HoursSetupStep store={store} isComplete={step.isComplete} onComplete={handleStepComplete} />
              )}
              {step.id === 'team' && (
                <TeamSetupStep store={store} onComplete={handleStepComplete} />
              )}
              {step.id === 'suppliers' && (
                <SuppliersSetupStep storeId={store.id} isComplete={step.isComplete} onComplete={handleStepComplete} />
              )}
              {step.id === 'menu' && (
                <MenuSetupStep storeId={store.id} onComplete={handleStepComplete} />
              )}
            </SetupStepCard>
          )
        })}
      </div>

    </div>
  )
}
