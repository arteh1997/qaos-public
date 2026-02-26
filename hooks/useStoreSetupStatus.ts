'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabaseFetch, supabaseUpdate } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Store } from '@/types'
import { SetupStep, SetupStepId, StoreSetupStatus, SetupStatusData } from '@/types/setup'
import { Package, Clock, Users, Truck, UtensilsCrossed } from 'lucide-react'

/**
 * Setup steps in order: inventory → hours → suppliers → menu → team
 * Owner sets up everything their business needs before inviting staff.
 */
const SETUP_STEPS_CONFIG: Omit<SetupStep, 'isComplete'>[] = [
  {
    id: 'inventory',
    title: 'Add Your Inventory',
    description: 'Import your items from a spreadsheet to start tracking stock',
    isRequired: true,
    icon: Package,
  },
  {
    id: 'hours',
    title: 'Set Operating Hours',
    description: 'Configure your store\'s opening and closing times',
    isRequired: true,
    icon: Clock,
  },
  {
    id: 'suppliers',
    title: 'Add Your Suppliers',
    description: 'Add the suppliers you order from so you can track deliveries',
    isRequired: true,
    icon: Truck,
  },
  {
    id: 'menu',
    title: 'Set Up Your Menu',
    description: 'Add your menu items with pricing so you can track food costs',
    isRequired: true,
    icon: UtensilsCrossed,
  },
  {
    id: 'team',
    title: 'Invite Your Team',
    description: 'Add staff members so they can start using the system',
    isRequired: true,
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
    case 'suppliers':
      return data.supplierCount > 0
    case 'menu':
      return data.menuItemCount > 0
    case 'team':
      return data.teamMemberCount > 0
    default:
      return false
  }
}

/**
 * Hook to determine store setup status
 * Returns whether setup is complete and the status of each step.
 * When all steps are completed, auto-stamps `setup_completed_at` on the store.
 */
export function useStoreSetupStatus(storeId: string | null) {
  const { user, refreshProfile } = useAuth()
  const router = useRouter()
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

      // If store already completed setup, skip the heavy queries
      if (storeRecord?.setup_completed_at) {
        setStatus({
          isSetupComplete: true,
          steps: SETUP_STEPS_CONFIG.map(config => ({ ...config, isComplete: true })),
          completedCount: SETUP_STEPS_CONFIG.length,
          requiredCount: SETUP_STEPS_CONFIG.length,
          totalCount: SETUP_STEPS_CONFIG.length,
        })
        return
      }

      // Fetch all counts in parallel
      const [inventoryResult, teamResult, supplierResult, menuResult] = await Promise.all([
        supabaseFetch<{ id: string }>('store_inventory', {
          select: 'id',
          filter: { store_id: `eq.${storeId}` },
          count: true,
          range: { from: 0, to: 0 },
        }),
        supabaseFetch<{ id: string }>('store_users', {
          select: 'id',
          filter: {
            store_id: `eq.${storeId}`,
            ...(user?.id ? { user_id: `neq.${user.id}` } : {}),
          },
          count: true,
          range: { from: 0, to: 0 },
        }),
        supabaseFetch<{ id: string }>('suppliers', {
          select: 'id',
          filter: { store_id: `eq.${storeId}` },
          count: true,
          range: { from: 0, to: 0 },
        }),
        supabaseFetch<{ id: string }>('menu_items', {
          select: 'id',
          filter: { store_id: `eq.${storeId}` },
          count: true,
          range: { from: 0, to: 0 },
        }),
      ])

      if (inventoryResult.error) throw inventoryResult.error
      if (teamResult.error) throw teamResult.error
      if (supplierResult.error) throw supplierResult.error
      if (menuResult.error) throw menuResult.error

      // Compile status data
      const statusData: SetupStatusData = {
        inventoryCount: inventoryResult.count ?? 0,
        hasOpeningTime: Boolean(storeRecord?.opening_time),
        hasClosingTime: Boolean(storeRecord?.closing_time),
        teamMemberCount: teamResult.count ?? 0,
        supplierCount: supplierResult.count ?? 0,
        menuItemCount: menuResult.count ?? 0,
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

      // Auto-stamp setup_completed_at when all steps are done
      if (isSetupComplete && storeRecord && !storeRecord.setup_completed_at) {
        await supabaseUpdate('stores', storeRecord.id, {
          setup_completed_at: new Date().toISOString(),
        })
        // Refresh auth context so sidebar/layout pick up the new setup_completed_at
        await refreshProfile()
        // Navigate to main dashboard — replace so back button doesn't return to setup
        router.replace('/')
      }

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
