import { z } from 'zod'

/**
 * Validation schemas for Supplier Portal
 */

// Token generation request
export const createPortalTokenSchema = z.object({
  name: z
    .string()
    .min(1, 'Token name is required')
    .max(100, 'Token name must be under 100 characters'),
  can_view_orders: z.boolean().default(true),
  can_upload_invoices: z.boolean().default(true),
  can_update_catalog: z.boolean().default(true),
  can_update_order_status: z.boolean().default(false),
  expires_at: z.string().datetime().optional(),
})

export type CreatePortalTokenData = z.infer<typeof createPortalTokenSchema>

// Token update (only name and permissions — cannot change the token itself)
export const updatePortalTokenSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  can_view_orders: z.boolean().optional(),
  can_upload_invoices: z.boolean().optional(),
  can_update_catalog: z.boolean().optional(),
  can_update_order_status: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

export type UpdatePortalTokenData = z.infer<typeof updatePortalTokenSchema>

// Supplier catalog item update (pricing, lead time, etc.)
export const updateCatalogItemSchema = z.object({
  unit_cost: z.number().min(0, 'Unit cost must be positive').optional(),
  lead_time_days: z.number().int().min(0).max(365).optional(),
  min_order_quantity: z.number().min(0).optional(),
  is_active: z.boolean().optional(),
})

export type UpdateCatalogItemData = z.infer<typeof updateCatalogItemSchema>

// Bulk catalog update
export const updateCatalogSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      unit_cost: z.number().min(0).optional(),
      lead_time_days: z.number().int().min(0).max(365).optional(),
      min_order_quantity: z.number().min(0).optional(),
    })
  ),
})

export type UpdateCatalogData = z.infer<typeof updateCatalogSchema>

// PO status update by supplier
export const updateOrderStatusSchema = z.object({
  status: z.enum(['acknowledged', 'shipped']),
  notes: z.string().max(500).optional(),
})

export type UpdateOrderStatusData = z.infer<typeof updateOrderStatusSchema>
