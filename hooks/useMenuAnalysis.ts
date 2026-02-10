import { useState, useCallback } from 'react'
import { useCSRF } from './useCSRF'
import type { MenuItem } from '@/types'
import type { CreateMenuItemFormData } from '@/lib/validations/recipes'

interface MenuAnalysisItem {
  id: string
  name: string
  category: string | null
  selling_price: number
  food_cost: number
  food_cost_percentage: number
  profit_margin: number
  has_recipe: boolean
  recipe_name: string | null
  rating: 'excellent' | 'good' | 'fair' | 'poor' | 'no_recipe'
}

interface MenuAnalysis {
  summary: {
    total_menu_items: number
    items_with_recipe: number
    items_without_recipe: number
    average_food_cost_percentage: number
    target_food_cost_percentage: number
    total_revenue_potential: number
    total_food_cost: number
    total_profit: number
    rating_distribution: {
      excellent: number
      good: number
      fair: number
      poor: number
      no_recipe: number
    }
  }
  items: MenuAnalysisItem[]
  categories: Array<{
    category: string
    item_count: number
    avg_food_cost_pct: number
    total_revenue: number
    total_cost: number
    total_profit: number
  }>
  cost_alerts: MenuAnalysisItem[]
}

interface UseMenuAnalysisResult {
  analysis: MenuAnalysis | null
  isLoading: boolean
  error: string | null
  fetchAnalysis: (targetFoodCost?: number) => Promise<void>
}

export function useMenuAnalysis(storeId: string | null): UseMenuAnalysisResult {
  const [analysis, setAnalysis] = useState<MenuAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalysis = useCallback(async (targetFoodCost?: number) => {
    if (!storeId) return

    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (targetFoodCost !== undefined) params.set('targetFoodCost', String(targetFoodCost))

      const queryString = params.toString()
      const url = `/api/stores/${storeId}/menu-analysis${queryString ? `?${queryString}` : ''}`

      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) throw new Error(data.message || 'Failed to fetch menu analysis')

      setAnalysis(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch menu analysis')
    } finally {
      setIsLoading(false)
    }
  }, [storeId])

  return { analysis, isLoading, error, fetchAnalysis }
}

// Hook for menu items CRUD
interface UseMenuItemsResult {
  menuItems: (MenuItem & { food_cost: number; food_cost_percentage: number; profit_margin: number })[]
  isLoading: boolean
  error: string | null
  fetchMenuItems: () => Promise<void>
  createMenuItem: (data: CreateMenuItemFormData) => Promise<MenuItem>
  updateMenuItem: (menuItemId: string, data: Partial<CreateMenuItemFormData>) => Promise<MenuItem>
  deleteMenuItem: (menuItemId: string) => Promise<void>
  isSubmitting: boolean
}

export function useMenuItems(storeId: string | null): UseMenuItemsResult {
  const { csrfFetch } = useCSRF()
  const [menuItems, setMenuItems] = useState<(MenuItem & { food_cost: number; food_cost_percentage: number; profit_margin: number })[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchMenuItems = useCallback(async () => {
    if (!storeId) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/stores/${storeId}/menu-items`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.message || 'Failed to fetch menu items')

      setMenuItems(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch menu items')
    } finally {
      setIsLoading(false)
    }
  }, [storeId])

  const createMenuItem = useCallback(async (formData: CreateMenuItemFormData): Promise<MenuItem> => {
    if (!storeId) throw new Error('No store selected')

    try {
      setIsSubmitting(true)
      const response = await csrfFetch(`/api/stores/${storeId}/menu-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to create menu item')

      return data.data
    } finally {
      setIsSubmitting(false)
    }
  }, [storeId, csrfFetch])

  const updateMenuItem = useCallback(async (menuItemId: string, formData: Partial<CreateMenuItemFormData>): Promise<MenuItem> => {
    if (!storeId) throw new Error('No store selected')

    try {
      setIsSubmitting(true)
      const response = await csrfFetch(`/api/stores/${storeId}/menu-items/${menuItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to update menu item')

      return data.data
    } finally {
      setIsSubmitting(false)
    }
  }, [storeId, csrfFetch])

  const deleteMenuItem = useCallback(async (menuItemId: string): Promise<void> => {
    if (!storeId) throw new Error('No store selected')

    try {
      setIsSubmitting(true)
      const response = await csrfFetch(`/api/stores/${storeId}/menu-items/${menuItemId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to delete menu item')
    } finally {
      setIsSubmitting(false)
    }
  }, [storeId, csrfFetch])

  return {
    menuItems,
    isLoading,
    error,
    fetchMenuItems,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    isSubmitting,
  }
}
