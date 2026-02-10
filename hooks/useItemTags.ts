import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

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
      // Get CSRF token
      const csrfResponse = await fetch('/api/auth/csrf')
      const { token } = await csrfResponse.json()

      const response = await fetch(
        `/api/stores/${storeId}/inventory/${itemId}/tags`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': token,
          },
          credentials: 'include',
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
