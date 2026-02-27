import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { NotificationPreference } from '@/types'
import { getCSRFHeaders } from '@/hooks/useCSRF'

interface UseNotificationPreferencesResult {
  preferences: NotificationPreference | null
  isLoading: boolean
  error: string | null
  updatePreferences: (updates: Partial<NotificationPreference>) => Promise<NotificationPreference>
  isUpdating: boolean
}

const DEFAULT_PREFERENCES: Omit<NotificationPreference, 'id' | 'store_id' | 'user_id' | 'created_at' | 'updated_at'> = {
  shift_assigned: true,
  shift_updated: true,
  shift_cancelled: true,
  payslip_available: true,
  po_supplier_update: true,
  delivery_received: true,
  removed_from_store: true,
}

export function useNotificationPreferences(storeId: string | null): UseNotificationPreferencesResult {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['notification-preferences', storeId],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/notification-preferences`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch notification preferences')
      }

      return data.data as NotificationPreference
    },
    enabled: !!storeId,
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreference>) => {
      const response = await fetch(`/api/stores/${storeId}/notification-preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeaders() },
        body: JSON.stringify(updates),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update notification preferences')
      }

      return data.data as NotificationPreference
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['notification-preferences', storeId], data)
    },
  })

  return {
    preferences: query.data ?? (storeId ? { ...DEFAULT_PREFERENCES, store_id: storeId, user_id: '', id: '', created_at: '', updated_at: '' } as NotificationPreference : null),
    isLoading: query.isLoading,
    error: query.error?.message ?? updateMutation.error?.message ?? null,
    updatePreferences: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  }
}
