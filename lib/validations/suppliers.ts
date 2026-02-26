import { z } from 'zod'

// ============================================================
// SUPPLIER SCHEMAS
// ============================================================

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(100, 'Name must be under 100 characters'),
  email: z.string().email('Invalid email address').max(200).optional().or(z.literal('')),
  phone: z.string().max(30, 'Phone must be under 30 characters').optional().or(z.literal('')),
  address: z.string().max(500, 'Address must be under 500 characters').optional().or(z.literal('')),
  contact_person: z.string().max(100, 'Contact person name must be under 100 characters').optional().or(z.literal('')),
  payment_terms: z.string().max(50, 'Payment terms must be under 50 characters').optional().or(z.literal('')),
  notes: z.string().max(1000, 'Notes must be under 1000 characters').optional().or(z.literal('')),
  is_active: z.boolean().optional(),
})

export const updateSupplierSchema = createSupplierSchema.partial()

// ============================================================
// SUPPLIER ITEM SCHEMAS
// ============================================================

export const supplierItemSchema = z.object({
  inventory_item_id: z.string().uuid('Invalid inventory item'),
  supplier_sku: z.string().max(50, 'SKU must be under 50 characters').optional().or(z.literal('')),
  unit_cost: z.number().min(0, 'Unit cost cannot be negative'),
  currency: z.string().max(3).default('GBP'),
  lead_time_days: z.number().int().min(0, 'Lead time cannot be negative').optional(),
  min_order_quantity: z.number().min(0, 'Minimum order quantity cannot be negative').default(1),
  is_preferred: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

export const updateSupplierItemSchema = supplierItemSchema.partial().omit({ inventory_item_id: true })

// ============================================================
// PURCHASE ORDER SCHEMAS
// ============================================================

export const purchaseOrderItemSchema = z.object({
  inventory_item_id: z.string().uuid('Invalid inventory item'),
  quantity_ordered: z.number().positive('Quantity must be greater than 0'),
  unit_price: z.number().min(0, 'Unit price cannot be negative'),
  notes: z.string().max(500).optional().or(z.literal('')),
})

export const createPurchaseOrderSchema = z.object({
  supplier_id: z.string().uuid('Invalid supplier'),
  order_date: z.string().optional(),
  expected_delivery_date: z.string().optional(),
  notes: z.string().max(1000, 'Notes must be under 1000 characters').optional().or(z.literal('')),
  currency: z.string().max(3).default('GBP'),
  items: z.array(purchaseOrderItemSchema).min(1, 'At least one item is required'),
})

export const updatePurchaseOrderSchema = z.object({
  status: z.enum(['open', 'awaiting_delivery', 'partial', 'received', 'cancelled']).optional(),
  expected_delivery_date: z.string().optional(),
  notes: z.string().max(1000).optional().or(z.literal('')),
})

export const receivePurchaseOrderSchema = z.object({
  items: z.array(z.object({
    purchase_order_item_id: z.string().uuid('Invalid line item'),
    quantity_received: z.number().min(0, 'Quantity cannot be negative'),
  })).min(1, 'At least one item is required'),
  notes: z.string().max(1000).optional().or(z.literal('')),
})

// ============================================================
// INFERRED TYPES
// ============================================================

export type CreateSupplierFormData = z.infer<typeof createSupplierSchema>
export type UpdateSupplierFormData = z.infer<typeof updateSupplierSchema>
export type SupplierItemFormData = z.infer<typeof supplierItemSchema>
export type UpdateSupplierItemFormData = z.infer<typeof updateSupplierItemSchema>
export type CreatePurchaseOrderFormData = z.infer<typeof createPurchaseOrderSchema>
export type UpdatePurchaseOrderFormData = z.infer<typeof updatePurchaseOrderSchema>
export type ReceivePurchaseOrderFormData = z.infer<typeof receivePurchaseOrderSchema>
