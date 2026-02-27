import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCSRFHeaders } from '@/hooks/useCSRF'
import type { Recipe, RecipeIngredient } from '@/types'
import type { CreateRecipeFormData, RecipeIngredientFormData } from '@/lib/validations/recipes'

interface UseRecipesResult {
  recipes: (Recipe & { ingredient_count: number })[]
  isLoading: boolean
  error: string | null
  fetchRecipes: (options?: { category?: string; active?: boolean }) => Promise<void>
  createRecipe: (data: CreateRecipeFormData) => Promise<Recipe>
  updateRecipe: (recipeId: string, data: Partial<CreateRecipeFormData>) => Promise<Recipe>
  deleteRecipe: (recipeId: string) => Promise<void>
  isSubmitting: boolean
}

export function useRecipes(storeId: string | null): UseRecipesResult {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['recipes', storeId],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/recipes`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.message || 'Failed to fetch recipes')

      return (data.data || []) as (Recipe & { ingredient_count: number })[]
    },
    enabled: !!storeId,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: async (formData: CreateRecipeFormData): Promise<Recipe> => {
      if (!storeId) throw new Error('No store selected')

      const response = await fetch(`/api/stores/${storeId}/recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeaders() },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to create recipe')

      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes', storeId] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ recipeId, formData }: { recipeId: string; formData: Partial<CreateRecipeFormData> }): Promise<Recipe> => {
      if (!storeId) throw new Error('No store selected')

      const response = await fetch(`/api/stores/${storeId}/recipes/${recipeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeaders() },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to update recipe')

      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes', storeId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (recipeId: string): Promise<void> => {
      if (!storeId) throw new Error('No store selected')

      const response = await fetch(`/api/stores/${storeId}/recipes/${recipeId}`, {
        method: 'DELETE',
        headers: getCSRFHeaders(),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to delete recipe')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes', storeId] })
    },
  })

  // Backward-compatible fetchRecipes with filter options
  const fetchRecipes = async (options?: { category?: string; active?: boolean }) => {
    if (options) {
      if (!storeId) return
      const params = new URLSearchParams()
      if (options.category) params.set('category', options.category)
      if (options.active !== undefined) params.set('active', String(options.active))
      const queryString = params.toString()
      const url = `/api/stores/${storeId}/recipes${queryString ? `?${queryString}` : ''}`
      const response = await fetch(url)
      const data = await response.json()
      if (response.ok) {
        queryClient.setQueryData(['recipes', storeId], data.data || [])
      }
    } else {
      await query.refetch()
    }
  }

  return {
    recipes: query.data || [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    fetchRecipes,
    createRecipe: createMutation.mutateAsync,
    updateRecipe: (recipeId: string, data: Partial<CreateRecipeFormData>) =>
      updateMutation.mutateAsync({ recipeId, formData: data }),
    deleteRecipe: deleteMutation.mutateAsync,
    isSubmitting: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  }
}

// Hook for recipe detail with ingredients
interface UseRecipeDetailResult {
  recipe: (Recipe & { ingredients: RecipeIngredient[]; total_cost: number; cost_per_unit: number }) | null
  isLoading: boolean
  error: string | null
  fetchRecipe: () => Promise<void>
  addIngredient: (data: RecipeIngredientFormData) => Promise<RecipeIngredient>
  removeIngredient: (ingredientId: string) => Promise<void>
  isSubmitting: boolean
}

export function useRecipeDetail(storeId: string | null, recipeId: string | null): UseRecipeDetailResult {
  const queryClient = useQueryClient()

  type RecipeDetail = Recipe & { ingredients: RecipeIngredient[]; total_cost: number; cost_per_unit: number }

  const query = useQuery({
    queryKey: ['recipe-detail', storeId, recipeId],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/recipes/${recipeId}`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.message || 'Failed to fetch recipe')

      return data.data as RecipeDetail
    },
    enabled: !!storeId && !!recipeId,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  })

  const addIngredientMutation = useMutation({
    mutationFn: async (formData: RecipeIngredientFormData): Promise<RecipeIngredient> => {
      if (!storeId || !recipeId) throw new Error('Missing store or recipe')

      const response = await fetch(`/api/stores/${storeId}/recipes/${recipeId}/ingredients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeaders() },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to add ingredient')

      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', storeId, recipeId] })
      queryClient.invalidateQueries({ queryKey: ['recipes', storeId] })
    },
  })

  const removeIngredientMutation = useMutation({
    mutationFn: async (ingredientId: string): Promise<void> => {
      if (!storeId || !recipeId) throw new Error('Missing store or recipe')

      const response = await fetch(
        `/api/stores/${storeId}/recipes/${recipeId}/ingredients?ingredientId=${ingredientId}`,
        { method: 'DELETE', headers: getCSRFHeaders() }
      )

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to remove ingredient')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', storeId, recipeId] })
      queryClient.invalidateQueries({ queryKey: ['recipes', storeId] })
    },
  })

  return {
    recipe: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    fetchRecipe: async () => { await query.refetch() },
    addIngredient: addIngredientMutation.mutateAsync,
    removeIngredient: removeIngredientMutation.mutateAsync,
    isSubmitting: addIngredientMutation.isPending || removeIngredientMutation.isPending,
  }
}
