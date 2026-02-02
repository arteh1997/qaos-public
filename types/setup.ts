import type { LucideIcon } from 'lucide-react'

/**
 * Store Setup Wizard Types
 * Used for guiding new store owners through initial setup
 */

// Unique identifier for each setup step
export type SetupStepId = 'inventory' | 'hours' | 'team'

// Individual setup step configuration
export interface SetupStep {
  id: SetupStepId
  title: string
  description: string
  isRequired: boolean
  isComplete: boolean
  icon: LucideIcon
}

// Overall store setup status
export interface StoreSetupStatus {
  isSetupComplete: boolean
  steps: SetupStep[]
  completedCount: number
  requiredCount: number
  totalCount: number
}

// Data used to compute setup status
export interface SetupStatusData {
  inventoryCount: number
  hasOpeningTime: boolean
  hasClosingTime: boolean
  teamMemberCount: number // Excludes current user
}
