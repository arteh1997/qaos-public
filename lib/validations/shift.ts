import { z } from 'zod'

export const shiftSchema = z.object({
  store_id: z.string().uuid('Invalid store'),
  user_id: z.string().uuid('Invalid user'),
  start_time: z.string().min(1, 'Start time is required').refine((val) => {
    const date = new Date(val)
    return !isNaN(date.getTime())
  }, { message: 'Invalid start time' }),
  end_time: z.string().min(1, 'End time is required').refine((val) => {
    const date = new Date(val)
    return !isNaN(date.getTime())
  }, { message: 'Invalid end time' }),
  notes: z.string().optional(),
}).refine((data) => {
  const start = new Date(data.start_time)
  const end = new Date(data.end_time)
  return end > start
}, {
  message: 'End time must be after start time',
  path: ['end_time'],
})

export const clockInOutSchema = z.object({
  shift_id: z.string().uuid('Invalid shift'),
  action: z.enum(['clock_in', 'clock_out']),
})

export type ShiftFormData = z.infer<typeof shiftSchema>
export type ClockInOutFormData = z.infer<typeof clockInOutSchema>
