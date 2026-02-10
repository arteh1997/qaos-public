import { useState, useCallback } from 'react'
import { useCSRF } from './useCSRF'
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
  const { csrfFetch } = useCSRF()
  const [recipes, setRecipes] = useState<(Recipe & { ingredient_count: number })[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchRecipes = useCallback(async (options?: { category?: string; active?: boolean }) => {
    if (!storeId) return

    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (options?.category) params.set('category', options.category)
      if (options?.active !== undefined) params.set('active', String(options.active))

      const queryString = params.toString()
      const url = `/api/stores/${storeId}/recipes${queryString ? `?${queryString}` : ''}`

      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) throw new Error(data.message || 'Failed to fetch recipes')

      setRecipes(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recipes')
    } finally {
      setIsLoading(false)
    }
  }, [storeId])

  const createRecipe = useCallback(async (formData: CreateRecipeFormData): Promise<Recipe> => {
    if (!storeId) throw new Error('No store selected')

    try {
      setIsSubmitting(true)
      const response = await csrfFetch(`/api/stores/${storeId}/recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to create recipe')

      return data.data
    } finally {
      setIsSubmitting(false)
    }
  }, [storeId, csrfFetch])

  const updateRecipe = useCallback(async (recipeId: string, formData: Partial<CreateRecipeFormData>): Promise<Recipe> => {
    if (!storeId) throw new Error('No store selected')

    try {
      setIsSubmitting(true)
      const response = await csrfFetch(`/api/stores/${storeId}/recipes/${recipeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to update recipe')

      return data.data
    } finally {
      setIsSubmitting(false)
    }
  }, [storeId, csrfFetch])

  const deleteRecipe = useCallback(async (recipeId: string): Promise<void> => {
    if (!storeId) throw new Error('No store selected')

    try {
      setIsSubmitting(true)
      const response = await csrfFetch(`/api/stores/${storeId}/recipes/${recipeId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to delete recipe')
    } finally {
      setIsSubmitting(false)
    }
  }, [storeId, csrfFetch])

  return {
    recipes,
    isLoading,
    error,
    fetchRecipes,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    isSubmitting,
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
  const { csrfFetch } = useCSRF()
  const [recipe, setRecipe] = useState<(Recipe & { ingredients: RecipeIngredient[]; total_cost: number; cost_per_unit: number }) | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchRecipe = useCallback(async () => {
    if (!storeId || !recipeId) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/stores/${storeId}/recipes/${recipeId}`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.message || 'Failed to fetch recipe')

      setRecipe(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recipe')
    } finally {
      setIsLoading(false)
    }
  }, [storeId, recipeId])

  const addIngredient = useCallback(async (formData: RecipeIngredientFormData): Promise<RecipeIngredient> => {
    if (!storeId || !recipeId) throw new Error('Missing store or recipe')

    try {
      setIsSubmitting(true)
      const response = await csrfFetch(`/api/stores/${storeId}/recipes/${recipeId}/ingredients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to add ingredient')

      return data.data
    } finally {
      setIsSubmitting(false)
    }
  }, [storeId, recipeId, csrfFetch])

  const removeIngredient = useCallback(async (ingredientId: string): Promise<void> => {
    if (!storeId || !recipeId) throw new Error('Missing store or recipe')

    try {
      setIsSubmitting(true)
      const response = await csrfFetch(
        `/api/stores/${storeId}/recipes/${recipeId}/ingredients?ingredientId=${ingredientId}`,
        { method: 'DELETE' }
      )

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to remove ingredient')
    } finally {
      setIsSubmitting(false)
    }
  }, [storeId, recipeId, csrfFetch])

  return {
    recipe,
    isLoading,
    error,
    fetchRecipe,
    addIngredient,
    removeIngredient,
    isSubmitting,
  }
}
