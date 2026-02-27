'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCSRFHeaders } from '@/hooks/useCSRF'
import type { AccountingConnection, AccountingConfig, XeroAccount } from '@/types'
import { toast } from 'sonner'

interface ConnectionsResponse {
  connections: Omit<AccountingConnection, 'credentials'>[]
  recent_syncs: Record<string, unknown>[]
}

interface AccountsResponse {
  accounts: XeroAccount[]
  all_accounts: XeroAccount[]
}

interface SyncResult {
  synced: number
  failed: number
  results: { entity_id: string; success: boolean; external_id?: string; error?: string }[]
}

async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || `Failed to fetch`)
  }
  const json = await response.json()
  return json as T
}

/**
 * Fetch all accounting connections (Xero, QuickBooks) for a store.
 */
export function useAccountingConnections(storeId: string | undefined) {
  const query = useQuery({
    queryKey: ['accounting', storeId],
    queryFn: () => fetchJSON<ConnectionsResponse>(`/api/stores/${storeId}/accounting`),
    enabled: !!storeId,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  return {
    connections: query.data?.connections || [],
    recentSyncs: query.data?.recent_syncs || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

/**
 * Fetch chart of accounts from the connected provider.
 */
export function useAccountingAccounts(storeId: string | undefined, provider = 'xero') {
  const query = useQuery({
    queryKey: ['accounting-accounts', storeId, provider],
    queryFn: () =>
      fetchJSON<AccountsResponse>(`/api/stores/${storeId}/accounting/accounts?provider=${provider}`),
    enabled: !!storeId,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  return {
    expenseAccounts: query.data?.accounts || [],
    allAccounts: query.data?.all_accounts || [],
    isLoading: query.isLoading,
    error: query.error,
  }
}

/**
 * Fetch the GL mapping config for a store's accounting connection.
 */
export function useAccountingConfig(storeId: string | undefined, provider = 'xero') {
  const query = useQuery({
    queryKey: ['accounting-config', storeId, provider],
    queryFn: () =>
      fetchJSON<AccountingConfig>(`/api/stores/${storeId}/accounting/config?provider=${provider}`),
    enabled: !!storeId,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  return {
    config: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

/**
 * Update the GL mapping config.
 */
export function useUpdateAccountingConfig(storeId: string | undefined, provider = 'xero') {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (config: Partial<AccountingConfig>) => {
      const response = await fetch(
        `/api/stores/${storeId}/accounting/config?provider=${provider}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getCSRFHeaders() },
          body: JSON.stringify(config),
        }
      )
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to update config')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('Accounting config updated')
      queryClient.invalidateQueries({ queryKey: ['accounting-config', storeId, provider] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update config')
    },
  })
}

/**
 * Disconnect accounting provider.
 */
export function useDisconnectAccounting() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ storeId, provider }: { storeId: string; provider: string }) => {
      const response = await fetch(`/api/integrations/${provider}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeaders() },
        body: JSON.stringify({ store_id: storeId }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to disconnect')
      }
      return response.json()
    },
    onSuccess: (_, { storeId }) => {
      toast.success('Disconnected successfully')
      queryClient.invalidateQueries({ queryKey: ['accounting', storeId] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to disconnect')
    },
  })
}

/**
 * Trigger a manual sync to the accounting system.
 */
export function useTriggerSync(storeId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { entity_type?: string; entity_id?: string } = {}) => {
      const response = await fetch(`/api/stores/${storeId}/accounting/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeaders() },
        body: JSON.stringify(params),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Sync failed')
      }
      const json = await response.json()
      return json as SyncResult
    },
    onSuccess: (data) => {
      if (data.failed > 0) {
        toast.warning(`Synced ${data.synced}, ${data.failed} failed`)
      } else if (data.synced > 0) {
        toast.success(`Synced ${data.synced} item(s) to Xero`)
      } else {
        toast.info('Nothing to sync — all items are up to date')
      }
      queryClient.invalidateQueries({ queryKey: ['accounting', storeId] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Sync failed')
    },
  })
}
