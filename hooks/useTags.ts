import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface Tag {
  id: string
  store_id: string
  name: string
  description: string | null
  color: string | null
  created_at: string
  updated_at: string
  usage_count?: number
}

interface CreateTagData {
  name: string
  description?: string
  color?: string
}

interface UpdateTagData {
  name?: string
  description?: string
  color?: string
}

export function useTags(storeId: string) {
  return useQuery({
    queryKey: ['tags', storeId],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/tags`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch tags')
      }

      const data = await response.json()
      return data.data.tags as Tag[]
    },
    enabled: !!storeId,
  })
}

export function useCreateTag(storeId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateTagData) => {
      // Get CSRF token
      const csrfResponse = await fetch('/api/auth/csrf')
      const { token } = await csrfResponse.json()

      const response = await fetch(`/api/stores/${storeId}/tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
        },
        credentials: 'include',
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create tag')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', storeId] })
    },
  })
}

export function useUpdateTag(storeId: string, tagId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: UpdateTagData) => {
      // Get CSRF token
      const csrfResponse = await fetch('/api/auth/csrf')
      const { token } = await csrfResponse.json()

      const response = await fetch(`/api/stores/${storeId}/tags/${tagId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
        },
        credentials: 'include',
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update tag')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', storeId] })
    },
  })
}

export function useDeleteTag(storeId: string, tagId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      // Get CSRF token
      const csrfResponse = await fetch('/api/auth/csrf')
      const { token } = await csrfResponse.json()

      const response = await fetch(`/api/stores/${storeId}/tags/${tagId}`, {
        method: 'DELETE',
        headers: {
          'x-csrf-token': token,
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to delete tag')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', storeId] })
    },
  })
}
