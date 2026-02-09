import { z } from 'zod'

// Base shift schema without refinements (for partial updates)
export const shiftSchemaBase = z.object({
  store_id: z.string().uuid('Invalid store'),
  user_id: z.string().uuid('Invalid user'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  notes: z.string().optional(),
})

// Full shift schema with refinements (for creation)
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

// Partial schema for updates (uses base without refinements)
export const shiftUpdateSchema = shiftSchemaBase.partial()

export const clockInOutSchema = z.object({
  shift_id: z.string().uuid('Invalid shift'),
  action: z.enum(['clock_in', 'clock_out']),
})

/**
 * Schema for editing clock in/out times (manager/owner correction)
 * Both times are optional to allow clearing or setting just one
 */
export const editClockTimesSchema = z.object({
  clock_in_time: z.string().nullable().optional().refine((val) => {
    if (!val) return true // null/undefined is allowed
    const date = new Date(val)
    return !isNaN(date.getTime())
  }, { message: 'Invalid clock-in time' }),
  clock_out_time: z.string().nullable().optional().refine((val) => {
    if (!val) return true // null/undefined is allowed
    const date = new Date(val)
    return !isNaN(date.getTime())
  }, { message: 'Invalid clock-out time' }),
  notes: z.string().optional(),
}).refine((data) => {
  // If both times are provided, clock out must be after clock in
  if (data.clock_in_time && data.clock_out_time) {
    const clockIn = new Date(data.clock_in_time)
    const clockOut = new Date(data.clock_out_time)
    return clockOut > clockIn
  }
  return true
}, {
  message: 'Clock-out time must be after clock-in time',
  path: ['clock_out_time'],
})

export type ShiftFormData = z.infer<typeof shiftSchema>
export type ClockInOutFormData = z.infer<typeof clockInOutSchema>
export type EditClockTimesData = z.infer<typeof editClockTimesSchema>
