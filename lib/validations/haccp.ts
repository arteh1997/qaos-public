import { z } from 'zod'

export const haccpCheckTemplateSchema = z.object({
  name: z.string().min(2, 'Template name must be at least 2 characters').max(100),
  description: z.string().max(500).optional().nullable(),
  frequency: z.enum(['daily', 'weekly', 'shift']),
  items: z.array(z.object({
    id: z.string(),
    label: z.string().min(1),
    description: z.string().optional(),
    type: z.enum(['yes_no', 'temperature', 'text']),
    required: z.boolean(),
  })).min(1, 'At least one check item is required'),
  is_active: z.boolean().optional(),
})

export const haccpCheckSchema = z.object({
  template_id: z.string().uuid().optional().nullable(),
  items: z.array(z.object({
    template_item_id: z.string(),
    label: z.string(),
    value: z.union([z.string(), z.boolean(), z.number()]),
    passed: z.boolean(),
    notes: z.string().optional(),
  })),
  status: z.enum(['pass', 'fail', 'partial']),
  notes: z.string().max(1000).optional().nullable(),
})

export const haccpTemperatureLogSchema = z.object({
  location_name: z.string().min(1, 'Location name is required').max(100),
  temperature_celsius: z.number().min(-50).max(200),
  min_temp: z.number().optional().nullable(),
  max_temp: z.number().optional().nullable(),
  corrective_action: z.string().max(500).optional().nullable(),
})

export const haccpCorrectiveActionSchema = z.object({
  check_id: z.string().uuid().optional().nullable(),
  temp_log_id: z.string().uuid().optional().nullable(),
  description: z.string().min(5, 'Description must be at least 5 characters').max(1000),
  action_taken: z.string().max(1000).optional().nullable(),
})

export const haccpCorrectiveActionResolveSchema = z.object({
  action_taken: z.string().min(5, 'Action taken must be at least 5 characters').max(1000),
})
