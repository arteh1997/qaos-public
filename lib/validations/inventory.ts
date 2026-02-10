import { z } from 'zod'

export const inventoryItemSchema = z.object({
  store_id: z.string().uuid('Invalid store ID'), // Required for multi-tenant isolation
  name: z.string().min(2, 'Item name must be at least 2 characters'),
  category: z.string().optional(),
  unit_of_measure: z.string().min(1, 'Unit of measure is required'),
  is_active: z.boolean(),
})

export const storeInventorySchema = z.object({
  store_id: z.string().uuid('Invalid store'),
  inventory_item_id: z.string().uuid('Invalid inventory item'),
  quantity: z.number().min(0, 'Quantity cannot be negative'),
  par_level: z.number().min(0, 'PAR level cannot be negative').optional(),
})

export const stockCountSchema = z.object({
  store_id: z.string().uuid('Invalid store'),
  items: z.array(z.object({
    inventory_item_id: z.string().uuid('Invalid inventory item'),
    quantity: z.number().min(0, 'Quantity cannot be negative'),
  })),
  notes: z.string().optional(),
})

export const stockReceptionSchema = z.object({
  store_id: z.string().uuid('Invalid store'),
  items: z.array(z.object({
    inventory_item_id: z.string().uuid('Invalid inventory item'),
    quantity: z.number().min(0, 'Quantity cannot be negative'),
  })).min(1, 'At least one item is required'),
  notes: z.string().optional(),
})

export const wasteReportSchema = z.object({
  store_id: z.string().uuid('Invalid store'),
  items: z.array(z.object({
    inventory_item_id: z.string().uuid('Invalid inventory item'),
    quantity: z.number().min(0, 'Quantity cannot be negative'),
    reason: z.enum(['spoilage', 'damaged', 'expired', 'overproduction', 'other']).optional(),
  })).min(1, 'At least one item is required'),
  notes: z.string().optional(),
})

export type WasteReportFormData = z.infer<typeof wasteReportSchema>
export type WasteReason = 'spoilage' | 'damaged' | 'expired' | 'overproduction' | 'other'
export type InventoryItemFormData = z.infer<typeof inventoryItemSchema>
export type StoreInventoryFormData = z.infer<typeof storeInventorySchema>
export type StockCountFormData = z.infer<typeof stockCountSchema>
export type StockReceptionFormData = z.infer<typeof stockReceptionSchema>
