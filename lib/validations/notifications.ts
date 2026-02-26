import { z } from 'zod'

export const updateNotificationPreferencesSchema = z.object({
  shift_assigned: z.boolean().optional(),
  shift_updated: z.boolean().optional(),
  shift_cancelled: z.boolean().optional(),
  payslip_available: z.boolean().optional(),
  po_supplier_update: z.boolean().optional(),
  delivery_received: z.boolean().optional(),
  removed_from_store: z.boolean().optional(),
})

export type UpdateNotificationPreferences = z.infer<typeof updateNotificationPreferencesSchema>
