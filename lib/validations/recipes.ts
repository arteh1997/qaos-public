import { z } from 'zod'

export const createRecipeSchema = z.object({
  name: z.string().min(1, 'Recipe name is required').max(100, 'Name must be under 100 characters'),
  description: z.string().max(500).optional(),
  category: z.string().max(50).optional(),
  yield_quantity: z.number().positive('Yield must be greater than 0'),
  yield_unit: z.string().min(1, 'Yield unit is required').max(30),
  prep_time_minutes: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
})

export const updateRecipeSchema = createRecipeSchema.partial()

export const recipeIngredientSchema = z.object({
  inventory_item_id: z.string().uuid('Invalid inventory item'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unit_of_measure: z.string().min(1, 'Unit of measure is required'),
  notes: z.string().max(200).optional(),
})

export const createMenuItemSchema = z.object({
  name: z.string().min(1, 'Menu item name is required').max(100),
  description: z.string().max(500).optional(),
  category: z.string().max(50).optional(),
  recipe_id: z.string().uuid('Invalid recipe').optional(),
  selling_price: z.number().min(0, 'Price cannot be negative'),
  currency: z.string().default('USD'),
  is_active: z.boolean().optional(),
})

export const updateMenuItemSchema = createMenuItemSchema.partial()

export const updateItemCostSchema = z.object({
  unit_cost: z.number().min(0, 'Unit cost cannot be negative'),
  cost_currency: z.string().default('USD'),
})

export type CreateRecipeFormData = z.infer<typeof createRecipeSchema>
export type UpdateRecipeFormData = z.infer<typeof updateRecipeSchema>
export type RecipeIngredientFormData = z.infer<typeof recipeIngredientSchema>
export type CreateMenuItemFormData = z.infer<typeof createMenuItemSchema>
export type UpdateMenuItemFormData = z.infer<typeof updateMenuItemSchema>
export type UpdateItemCostFormData = z.infer<typeof updateItemCostSchema>
