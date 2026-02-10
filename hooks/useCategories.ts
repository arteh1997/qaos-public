import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface Category {
  id: string
  store_id: string
  name: string
  description: string | null
  color: string | null
  sort_order: number
  created_at: string
  updated_at: string
  item_count?: number
}

interface CreateCategoryData {
  name: string
  description?: string
  color?: string
  sort_order?: number
}

interface UpdateCategoryData {
  name?: string
  description?: string
  color?: string
  sort_order?: number
}

export function useCategories(storeId: string) {
  return useQuery({
    queryKey: ['categories', storeId],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/categories`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch categories')
      }

      const data = await response.json()
      return data.data.categories as Category[]
    },
    enabled: !!storeId,
  })
}

export function useCreateCategory(storeId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateCategoryData) => {
      // Get CSRF token
      const csrfResponse = await fetch('/api/auth/csrf')
      const { token } = await csrfResponse.json()

      const response = await fetch(`/api/stores/${storeId}/categories`, {
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
        throw new Error(error.message || 'Failed to create category')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', storeId] })
    },
  })
}

export function useUpdateCategory(storeId: string, categoryId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: UpdateCategoryData) => {
      // Get CSRF token
      const csrfResponse = await fetch('/api/auth/csrf')
      const { token } = await csrfResponse.json()

      const response = await fetch(`/api/stores/${storeId}/categories/${categoryId}`, {
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
        throw new Error(error.message || 'Failed to update category')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', storeId] })
    },
  })
}

export function useDeleteCategory(storeId: string, categoryId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      // Get CSRF token
      const csrfResponse = await fetch('/api/auth/csrf')
      const { token } = await csrfResponse.json()

      const response = await fetch(`/api/stores/${storeId}/categories/${categoryId}`, {
        method: 'DELETE',
        headers: {
          'x-csrf-token': token,
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to delete category')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', storeId] })
    },
  })
}
