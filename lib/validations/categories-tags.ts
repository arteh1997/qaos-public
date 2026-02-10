/**
 * Validation Schemas for Categories and Tags
 */

import { z } from 'zod'

// ============================================================================
// Category Schemas
// ============================================================================

/**
 * Schema for creating a new category
 */
export const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Category name is required')
    .max(100, 'Category name must be 100 characters or less')
    .trim(),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .nullable()
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex code (e.g., #EF4444)')
    .nullable()
    .optional(),
  sort_order: z
    .number()
    .int('Sort order must be an integer')
    .min(0, 'Sort order must be 0 or greater')
    .optional(),
})

/**
 * Schema for updating an existing category
 */
export const updateCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Category name is required')
    .max(100, 'Category name must be 100 characters or less')
    .trim()
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .nullable()
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex code (e.g., #EF4444)')
    .nullable()
    .optional(),
  sort_order: z
    .number()
    .int('Sort order must be an integer')
    .min(0, 'Sort order must be 0 or greater')
    .optional(),
})

// ============================================================================
// Tag Schemas
// ============================================================================

/**
 * Schema for creating a new tag
 */
export const createTagSchema = z.object({
  name: z
    .string()
    .min(1, 'Tag name is required')
    .max(100, 'Tag name must be 100 characters or less')
    .trim(),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .nullable()
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex code (e.g., #EF4444)')
    .nullable()
    .optional(),
})

/**
 * Schema for updating an existing tag
 */
export const updateTagSchema = z.object({
  name: z
    .string()
    .min(1, 'Tag name is required')
    .max(100, 'Tag name must be 100 characters or less')
    .trim()
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .nullable()
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex code (e.g., #EF4444)')
    .nullable()
    .optional(),
})

// ============================================================================
// Item Tag Assignment Schemas
// ============================================================================

/**
 * Schema for adding tags to an inventory item
 */
export const addTagsToItemSchema = z.object({
  tagIds: z
    .array(z.string().uuid('Each tag ID must be a valid UUID'))
    .min(1, 'At least one tag ID is required')
    .max(20, 'Cannot add more than 20 tags at once'),
})

/**
 * Schema for removing tags from an inventory item
 */
export const removeTagsFromItemSchema = z.object({
  tagIds: z
    .array(z.string().uuid('Each tag ID must be a valid UUID'))
    .max(20, 'Cannot remove more than 20 tags at once')
    .optional(),
})

// ============================================================================
// Type Exports
// ============================================================================

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
export type CreateTagInput = z.infer<typeof createTagSchema>
export type UpdateTagInput = z.infer<typeof updateTagSchema>
export type AddTagsToItemInput = z.infer<typeof addTagsToItemSchema>
export type RemoveTagsFromItemInput = z.infer<typeof removeTagsFromItemSchema>
