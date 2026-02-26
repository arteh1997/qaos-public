import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCSRFHeaders } from '@/hooks/useCSRF'

export function useItemTags(storeId: string, itemId: string) {
  return useQuery({
    queryKey: ['itemTags', storeId, itemId],
    queryFn: async () => {
      const response = await fetch(
        `/api/stores/${storeId}/inventory/${itemId}/tags`,
        { credentials: 'include' }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch item tags')
      }

      const data = await response.json()
      return data.data.tag_ids as string[]
    },
    enabled: !!storeId && !!itemId,
  })
}

export function useUpdateItemTags(storeId: string, itemId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (tagIds: string[]) => {
      const response = await fetch(
        `/api/stores/${storeId}/inventory/${itemId}/tags`,
        {
          method: 'PUT',
          headers: getCSRFHeaders(),
          body: JSON.stringify({ tag_ids: tagIds }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update item tags')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itemTags', storeId, itemId] })
      queryClient.invalidateQueries({ queryKey: ['tags', storeId] })
    },
  })
}
