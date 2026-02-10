import { describe, it, expect } from 'vitest'
import {
  createRecipeSchema,
  updateRecipeSchema,
  recipeIngredientSchema,
  createMenuItemSchema,
  updateItemCostSchema,
} from '@/lib/validations/recipes'

const validUuid = '123e4567-e89b-12d3-a456-426614174000'

describe('Recipe Validation Schemas', () => {
  describe('createRecipeSchema', () => {
    it('should accept valid recipe', () => {
      const result = createRecipeSchema.safeParse({
        name: 'Margherita Pizza',
        description: 'Classic Italian pizza',
        category: 'Pizza',
        yield_quantity: 4,
        yield_unit: 'serving',
        prep_time_minutes: 30,
      })
      expect(result.success).toBe(true)
    })

    it('should accept minimal recipe', () => {
      const result = createRecipeSchema.safeParse({
        name: 'Simple Salad',
        yield_quantity: 1,
        yield_unit: 'serving',
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty name', () => {
      const result = createRecipeSchema.safeParse({
        name: '',
        yield_quantity: 1,
        yield_unit: 'serving',
      })
      expect(result.success).toBe(false)
    })

    it('should reject zero yield', () => {
      const result = createRecipeSchema.safeParse({
        name: 'Test',
        yield_quantity: 0,
        yield_unit: 'serving',
      })
      expect(result.success).toBe(false)
    })

    it('should reject negative yield', () => {
      const result = createRecipeSchema.safeParse({
        name: 'Test',
        yield_quantity: -1,
        yield_unit: 'serving',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty yield_unit', () => {
      const result = createRecipeSchema.safeParse({
        name: 'Test',
        yield_quantity: 1,
        yield_unit: '',
      })
      expect(result.success).toBe(false)
    })

    it('should reject name over 100 characters', () => {
      const result = createRecipeSchema.safeParse({
        name: 'A'.repeat(101),
        yield_quantity: 1,
        yield_unit: 'serving',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('updateRecipeSchema', () => {
    it('should accept partial update', () => {
      const result = updateRecipeSchema.safeParse({ name: 'Updated Name' })
      expect(result.success).toBe(true)
    })

    it('should accept empty update', () => {
      const result = updateRecipeSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe('recipeIngredientSchema', () => {
    it('should accept valid ingredient', () => {
      const result = recipeIngredientSchema.safeParse({
        inventory_item_id: validUuid,
        quantity: 0.5,
        unit_of_measure: 'kg',
      })
      expect(result.success).toBe(true)
    })

    it('should accept with notes', () => {
      const result = recipeIngredientSchema.safeParse({
        inventory_item_id: validUuid,
        quantity: 2,
        unit_of_measure: 'pieces',
        notes: 'Diced',
      })
      expect(result.success).toBe(true)
    })

    it('should reject zero quantity', () => {
      const result = recipeIngredientSchema.safeParse({
        inventory_item_id: validUuid,
        quantity: 0,
        unit_of_measure: 'kg',
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid UUID', () => {
      const result = recipeIngredientSchema.safeParse({
        inventory_item_id: 'not-a-uuid',
        quantity: 1,
        unit_of_measure: 'kg',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty unit_of_measure', () => {
      const result = recipeIngredientSchema.safeParse({
        inventory_item_id: validUuid,
        quantity: 1,
        unit_of_measure: '',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('createMenuItemSchema', () => {
    it('should accept valid menu item', () => {
      const result = createMenuItemSchema.safeParse({
        name: 'Margherita Pizza',
        selling_price: 12.99,
        recipe_id: validUuid,
      })
      expect(result.success).toBe(true)
    })

    it('should accept without recipe_id', () => {
      const result = createMenuItemSchema.safeParse({
        name: 'Water',
        selling_price: 2.50,
      })
      expect(result.success).toBe(true)
    })

    it('should accept zero price (complimentary)', () => {
      const result = createMenuItemSchema.safeParse({
        name: 'Bread Basket',
        selling_price: 0,
      })
      expect(result.success).toBe(true)
    })

    it('should reject negative price', () => {
      const result = createMenuItemSchema.safeParse({
        name: 'Test',
        selling_price: -5,
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty name', () => {
      const result = createMenuItemSchema.safeParse({
        name: '',
        selling_price: 10,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('updateItemCostSchema', () => {
    it('should accept valid cost update', () => {
      const result = updateItemCostSchema.safeParse({
        unit_cost: 5.50,
        cost_currency: 'USD',
      })
      expect(result.success).toBe(true)
    })

    it('should accept zero cost', () => {
      const result = updateItemCostSchema.safeParse({
        unit_cost: 0,
      })
      expect(result.success).toBe(true)
    })

    it('should reject negative cost', () => {
      const result = updateItemCostSchema.safeParse({
        unit_cost: -1,
      })
      expect(result.success).toBe(false)
    })
  })
})
