import { ShiftPattern, Store, DayOfWeek, WeeklyHours } from '@/types'

/**
 * Default shift patterns based on store operating hours
 * These are calculated relative to store opening time
 */
export const DEFAULT_SHIFT_PATTERNS: ShiftPattern[] = [
  {
    id: 'opening',
    name: 'Opening',
    start_offset_hours: 0, // Starts at store opening
    duration_hours: 8,
    color: '#22c55e', // Green
  },
  {
    id: 'mid',
    name: 'Mid',
    start_offset_hours: 4, // Starts 4 hours after opening
    duration_hours: 8,
    color: '#3b82f6', // Blue
  },
  {
    id: 'closing',
    name: 'Closing',
    start_offset_hours: -8, // Calculated from closing time (8 hours before close)
    duration_hours: 8,
    color: '#a855f7', // Purple
  },
]

/**
 * Calculate actual shift times based on store hours and pattern
 */
export function calculateShiftTimes(
  pattern: ShiftPattern,
  openingTime: string, // HH:MM
  closingTime: string, // HH:MM
  date: Date
): { start: Date; end: Date } {
  const [openHour, openMin] = openingTime.split(':').map(Number)
  const [closeHour, closeMin] = closingTime.split(':').map(Number)

  let startHour: number
  let startMin: number

  if (pattern.id === 'closing') {
    // Closing shift is calculated from closing time
    startHour = closeHour + pattern.start_offset_hours
    startMin = closeMin
  } else {
    // Other shifts calculated from opening time
    startHour = openHour + pattern.start_offset_hours
    startMin = openMin
  }

  // Create start time
  const start = new Date(date)
  start.setHours(startHour, startMin, 0, 0)

  // Create end time
  const end = new Date(start)
  end.setHours(end.getHours() + pattern.duration_hours)

  return { start, end }
}

/**
 * Parse time string to hours and minutes
 */
export function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return { hours, minutes }
}

/**
 * Format time for display
 */
export function formatShiftTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Calculate total hours between two times
 */
export function calculateHours(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime()
  return Math.round((diff / (1000 * 60 * 60)) * 10) / 10 // Round to 1 decimal
}

/**
 * Get week dates starting from Monday
 */
export function getWeekDates(referenceDate: Date): Date[] {
  const date = new Date(referenceDate)
  const day = date.getDay()
  // Adjust to get Monday (day 0 = Sunday, so we need to go back)
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)

  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(date)
    d.setDate(date.getDate() + i)
    dates.push(d)
  }
  return dates
}

/**
 * Format date for week header display
 */
export function formatWeekDay(date: Date): { day: string; date: string } {
  return {
    day: date.toLocaleDateString('en-US', { weekday: 'short' }),
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

/**
 * Get color for shift pattern
 */
export function getPatternColor(patternName: string): string {
  const pattern = DEFAULT_SHIFT_PATTERNS.find(
    p => p.name.toLowerCase() === patternName.toLowerCase()
  )
  return pattern?.color ?? '#6b7280' // Default gray
}

/**
 * Determine shift pattern from times (best guess)
 * Returns lowercase pattern id: 'opening', 'mid', 'closing', or 'custom'
 */
export function guessShiftPattern(
  startTime: Date,
  storeOpeningTime: string | null
): string {
  if (!storeOpeningTime) return 'custom'

  const [openHour] = storeOpeningTime.split(':').map(Number)
  const shiftStartHour = startTime.getHours()

  // If starts within 1 hour of opening = Opening
  if (Math.abs(shiftStartHour - openHour) <= 1) return 'opening'

  // If starts 3-5 hours after opening = Mid
  const hoursSinceOpen = shiftStartHour - openHour
  if (hoursSinceOpen >= 3 && hoursSinceOpen <= 5) return 'mid'

  // If starts in afternoon/evening = Closing
  if (shiftStartHour >= 14) return 'closing'

  return 'custom'
}

/**
 * Get day of week key from a Date object
 */
export function getDayOfWeekKey(date: Date): DayOfWeek {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[date.getDay()]
}

/**
 * Get store hours for a specific date
 * Returns the day-specific hours from weekly_hours if available,
 * otherwise falls back to default opening/closing times
 */
export function getStoreHoursForDate(
  store: Store,
  date: Date
): { openingTime: string | null; closingTime: string | null; isOpen: boolean } {
  const dayOfWeek = getDayOfWeekKey(date)

  // Check if store has weekly hours configured
  if (store.weekly_hours && store.weekly_hours[dayOfWeek]) {
    const dayHours = store.weekly_hours[dayOfWeek]
    return {
      openingTime: dayHours.opening_time,
      closingTime: dayHours.closing_time,
      isOpen: dayHours.is_open,
    }
  }

  // Fall back to default store hours
  return {
    openingTime: store.opening_time,
    closingTime: store.closing_time,
    isOpen: !!(store.opening_time && store.closing_time),
  }
}

/**
 * Check if store has hours configured for a specific date
 */
export function hasStoreHoursForDate(store: Store, date: Date): boolean {
  const hours = getStoreHoursForDate(store, date)
  return hours.isOpen && !!hours.openingTime && !!hours.closingTime
}
