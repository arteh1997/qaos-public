import { z } from 'zod'

export const hourlyRateSchema = z.object({
  hourly_rate: z
    .number()
    .min(0, 'Hourly rate cannot be negative')
    .max(999.99, 'Hourly rate seems too high'),
})

export const createPayRunSchema = z
  .object({
    period_start: z.string().min(1, 'Start date is required'),
    period_end: z.string().min(1, 'End date is required'),
    notes: z.string().optional(),
  })
  .refine(
    (data) => new Date(data.period_end) >= new Date(data.period_start),
    {
      message: 'End date must be on or after start date',
      path: ['period_end'],
    }
  )

export const updatePayRunSchema = z.object({
  status: z.enum(['approved', 'paid']).optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        user_id: z.string().uuid(),
        adjustments: z.number().optional(),
        adjustment_notes: z.string().optional(),
      })
    )
    .optional(),
})

export const earningsQuerySchema = z.object({
  from: z.string().min(1, 'Start date is required'),
  to: z.string().min(1, 'End date is required'),
  user_id: z.string().uuid().optional(),
})

export type HourlyRateData = z.infer<typeof hourlyRateSchema>
export type CreatePayRunData = z.infer<typeof createPayRunSchema>
export type UpdatePayRunData = z.infer<typeof updatePayRunSchema>
