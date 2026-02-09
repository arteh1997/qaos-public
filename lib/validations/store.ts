import { z } from 'zod'
import { DayOfWeek, WeeklyHours, DayHours, ShiftTimeSlot } from '@/types'

// Time format validation (HH:MM)
const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/

// Shift time slot schema
const shiftTimeSlotSchema = z.object({
  start_time: z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
  end_time: z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
})

// Shift patterns schema (optional for each day)
const shiftsSchema = z.object({
  opening: shiftTimeSlotSchema.optional(),
  mid: shiftTimeSlotSchema.optional(),
  closing: shiftTimeSlotSchema.optional(),
}).optional()

// Day hours schema
const dayHoursSchema = z.object({
  is_open: z.boolean(),
  opening_time: z.string().regex(timeRegex, 'Invalid time format (HH:MM)').nullable(),
  closing_time: z.string().regex(timeRegex, 'Invalid time format (HH:MM)').nullable(),
  shifts: shiftsSchema,
}).refine((data) => {
  // If open, both times must be set
  if (data.is_open && (!data.opening_time || !data.closing_time)) {
    return false
  }
  return true
}, {
  message: 'Open days must have both opening and closing times',
})

// Weekly hours schema
const weeklyHoursSchema = z.object({
  monday: dayHoursSchema,
  tuesday: dayHoursSchema,
  wednesday: dayHoursSchema,
  thursday: dayHoursSchema,
  friday: dayHoursSchema,
  saturday: dayHoursSchema,
  sunday: dayHoursSchema,
}).nullable().optional()

// Base store schema without refinements (for partial updates)
export const storeSchemaBase = z.object({
  name: z.string().min(2, 'Store name must be at least 2 characters'),
  address: z.string().optional(),
  is_active: z.boolean(),
  opening_time: z.string().regex(timeRegex, 'Invalid time format (HH:MM)').optional().nullable(),
  closing_time: z.string().regex(timeRegex, 'Invalid time format (HH:MM)').optional().nullable(),
  weekly_hours: weeklyHoursSchema,
  billing_user_id: z.string().uuid().optional().nullable(),
})

// Full store schema with refinements (for creation)
export const storeSchema = storeSchemaBase.refine((data) => {
  // If default times are set, both should be set
  if ((data.opening_time && !data.closing_time) || (!data.opening_time && data.closing_time)) {
    return false
  }
  return true
}, {
  message: 'Both default opening and closing times must be set, or leave both empty',
  path: ['closing_time'],
})

// Partial schema for updates (uses base without refinements)
export const storeUpdateSchema = storeSchemaBase.partial()

export type StoreFormData = z.infer<typeof storeSchema>

// Days of the week in order
export const DAYS_OF_WEEK: DayOfWeek[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
]

// Day labels for display
export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

// Short day labels
export const DAY_SHORT_LABELS: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

// Calculate default shift patterns based on opening/closing times
export function calculateDefaultShiftPatterns(openingTime: string, closingTime: string): DayHours['shifts'] {
  const [openHour, openMin] = openingTime.split(':').map(Number)
  const [closeHour, closeMin] = closingTime.split(':').map(Number)

  // Opening shift: starts at opening time, 8 hours
  const openingStart = openingTime
  const openingEndHour = openHour + 8
  const openingEnd = `${String(openingEndHour).padStart(2, '0')}:${String(openMin).padStart(2, '0')}`

  // Mid shift: starts 4 hours after opening, 8 hours
  const midStartHour = openHour + 4
  const midStart = `${String(midStartHour).padStart(2, '0')}:${String(openMin).padStart(2, '0')}`
  const midEndHour = midStartHour + 8
  const midEnd = `${String(midEndHour).padStart(2, '0')}:${String(openMin).padStart(2, '0')}`

  // Closing shift: ends at closing time, 8 hours before
  const closingEndHour = closeHour
  const closingEnd = closingTime
  const closingStartHour = closeHour - 8
  const closingStart = `${String(closingStartHour).padStart(2, '0')}:${String(closeMin).padStart(2, '0')}`

  return {
    opening: { start_time: openingStart, end_time: openingEnd },
    mid: { start_time: midStart, end_time: midEnd },
    closing: { start_time: closingStart, end_time: closingEnd },
  }
}

// Get default weekly hours with calculated shift patterns
export function getDefaultWeeklyHours(openingTime: string, closingTime: string): WeeklyHours {
  const shifts = calculateDefaultShiftPatterns(openingTime, closingTime)

  const dayHours: DayHours = {
    is_open: true,
    opening_time: openingTime,
    closing_time: closingTime,
    shifts,
  }

  return {
    monday: { ...dayHours, shifts: { ...shifts } },
    tuesday: { ...dayHours, shifts: { ...shifts } },
    wednesday: { ...dayHours, shifts: { ...shifts } },
    thursday: { ...dayHours, shifts: { ...shifts } },
    friday: { ...dayHours, shifts: { ...shifts } },
    saturday: { ...dayHours, shifts: { ...shifts } },
    sunday: { ...dayHours, shifts: { ...shifts } },
  }
}

// Get day of week from a Date object
export function getDayOfWeek(date: Date): DayOfWeek {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[date.getDay()]
}
