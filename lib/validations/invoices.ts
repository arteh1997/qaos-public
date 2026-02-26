import { z } from 'zod'

// Upload invoice (FormData validated separately, this is for metadata)
export const uploadInvoiceSchema = z.object({
  supplier_id: z.string().uuid().optional(),
  purchase_order_id: z.string().uuid().optional(),
})

// Update invoice metadata + line items
export const updateInvoiceSchema = z.object({
  invoice_number: z.string().max(100).optional(),
  invoice_date: z.string().optional(),
  due_date: z.string().optional(),
  subtotal: z.number().min(0).optional(),
  tax_amount: z.number().min(0).optional(),
  total_amount: z.number().min(0).optional(),
  supplier_id: z.string().uuid().nullable().optional(),
  purchase_order_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(['review', 'approved', 'rejected']).optional(),
  line_items: z.array(z.object({
    id: z.string().uuid().optional(), // existing line item to update
    description: z.string().max(500).optional(),
    quantity: z.number().min(0).nullable().optional(),
    unit_price: z.number().min(0).nullable().optional(),
    total_price: z.number().min(0).nullable().optional(),
    unit_of_measure: z.string().max(50).nullable().optional(),
    inventory_item_id: z.string().uuid().nullable().optional(),
    match_status: z.enum(['unmatched', 'auto_matched', 'manually_matched', 'skipped']).optional(),
    sort_order: z.number().int().min(0).optional(),
  })).optional(),
})

// Apply invoice to inventory
export const applyInvoiceSchema = z.object({
  notes: z.string().max(1000).optional(),
})

// File validation constants
export const INVOICE_FILE_CONFIG = {
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ] as const,
  storageBucket: 'invoices',
}
