'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabaseFetch } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Store } from '@/types'
import { SetupStep, SetupStepId, StoreSetupStatus, SetupStatusData } from '@/types/setup'
import { Package, Clock, Users } from 'lucide-react'

/**
 * Define the setup steps configuration
 */
const SETUP_STEPS_CONFIG: Omit<SetupStep, 'isComplete'>[] = [
  {
    id: 'inventory',
    title: 'Add Inventory Items',
    description: 'Add at least one inventory item to start tracking stock levels',
    isRequired: true,
    icon: Package,
  },
  {
    id: 'hours',
    title: 'Set Operating Hours',
    description: 'Configure your store\'s opening and closing times',
    isRequired: false,
    icon: Clock,
  },
  {
    id: 'team',
    title: 'Invite Team Members',
    description: 'Add staff members to help manage your store',
    isRequired: false,
    icon: Users,
  },
]

/**
 * Compute setup step completion status from data
 */
function computeStepCompletion(stepId: SetupStepId, data: SetupStatusData): boolean {
  switch (stepId) {
    case 'inventory':
      return data.inventoryCount > 0
    case 'hours':
      return data.hasOpeningTime && data.hasClosingTime
    case 'team':
      return data.teamMemberCount > 0
    default:
      return false
  }
}

/**
 * Hook to determine store setup status
 * Returns whether setup is complete and the status of each step
 */
export function useStoreSetupStatus(storeId: string | null) {
  const { user } = useAuth()
  const [status, setStatus] = useState<StoreSetupStatus>({
    isSetupComplete: false,
    steps: [],
    completedCount: 0,
    requiredCount: 0,
    totalCount: 0,
  })
  const [store, setStore] = useState<Store | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchSetupStatus = useCallback(async (isRefetch = false) => {
    if (!storeId) {
      setIsLoading(false)
      return
    }

    // Only show full loading on initial fetch, not refetches
    if (isRefetch) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)

    try {
      // Fetch store data
      const { data: storeData, error: storeError } = await supabaseFetch<Store>('stores', {
        filter: { id: `eq.${storeId}` },
      })

      if (storeError) throw storeError

      const storeRecord = storeData && storeData.length > 0 ? storeData[0] : null
      setStore(storeRecord)

      // Fetch inventory count for this store
      const { count: inventoryCount, error: invError } = await supabaseFetch<{ id: string }>(
        'store_inventory',
        {
          select: 'id',
          filter: { store_id: `eq.${storeId}` },
          count: true,
          range: { from: 0, to: 0 },
        }
      )

      if (invError) throw invError

      // Fetch team member count (excluding current user)
      const { count: teamCount, error: teamError } = await supabaseFetch<{ id: string }>(
        'store_users',
        {
          select: 'id',
          filter: {
            store_id: `eq.${storeId}`,
            ...(user?.id ? { user_id: `neq.${user.id}` } : {}),
          },
          count: true,
          range: { from: 0, to: 0 },
        }
      )

      if (teamError) throw teamError

      // Compile status data
      const statusData: SetupStatusData = {
        inventoryCount: inventoryCount ?? 0,
        hasOpeningTime: Boolean(storeRecord?.opening_time),
        hasClosingTime: Boolean(storeRecord?.closing_time),
        teamMemberCount: teamCount ?? 0,
      }

      // Build steps with completion status
      const steps: SetupStep[] = SETUP_STEPS_CONFIG.map(config => ({
        ...config,
        isComplete: computeStepCompletion(config.id, statusData),
      }))

      // Calculate counts
      const requiredSteps = steps.filter(s => s.isRequired)
      const completedRequired = requiredSteps.filter(s => s.isComplete)
      const allCompleted = steps.filter(s => s.isComplete)

      // Setup is complete if all required steps are done
      const isSetupComplete = completedRequired.length === requiredSteps.length

      setStatus({
        isSetupComplete,
        steps,
        completedCount: allCompleted.length,
        requiredCount: requiredSteps.length,
        totalCount: steps.length,
      })
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch setup status'))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [storeId, user?.id])

  useEffect(() => {
    fetchSetupStatus(false)
  }, [fetchSetupStatus])

  // Refetch function that doesn't show loading state
  const refetch = useCallback(() => {
    fetchSetupStatus(true)
  }, [fetchSetupStatus])

  return {
    status,
    store,
    isLoading,
    isRefreshing,
    error,
    refetch,
  }
}
