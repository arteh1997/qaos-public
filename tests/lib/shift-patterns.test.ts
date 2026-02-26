import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  DEFAULT_SHIFT_PATTERNS,
  calculateShiftTimes,
  parseTime,
  formatShiftTime,
  calculateHours,
  getWeekDates,
  formatWeekDay,
  isToday,
  getPatternColor,
  guessShiftPattern,
  getDayOfWeekKey,
  getStoreHoursForDate,
  hasStoreHoursForDate,
} from '@/lib/shift-patterns'
import { Store, DayOfWeek } from '@/types'

// Helper to create a mock store
function createMockStore(options: Partial<Store> = {}): Store {
  return {
    id: 'store-123',
    name: 'Test Store',
    address: '123 Test St',
    is_active: true,
    opening_time: '09:00',
    closing_time: '22:00',
    weekly_hours: null,
    billing_user_id: null,
    subscription_status: 'active',
    setup_completed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...options,
  }
}

describe('Shift Patterns Utilities', () => {
  describe('DEFAULT_SHIFT_PATTERNS', () => {
    it('should have three default patterns', () => {
      expect(DEFAULT_SHIFT_PATTERNS).toHaveLength(3)
    })

    it('should have opening, mid, and closing patterns', () => {
      const patternIds = DEFAULT_SHIFT_PATTERNS.map(p => p.id)
      expect(patternIds).toContain('opening')
      expect(patternIds).toContain('mid')
      expect(patternIds).toContain('closing')
    })

    it('should have valid colors for all patterns', () => {
      DEFAULT_SHIFT_PATTERNS.forEach(pattern => {
        expect(pattern.color).toMatch(/^#[0-9a-f]{6}$/i)
      })
    })

    it('should have 8-hour duration for all default patterns', () => {
      DEFAULT_SHIFT_PATTERNS.forEach(pattern => {
        expect(pattern.duration_hours).toBe(8)
      })
    })
  })

  describe('calculateShiftTimes', () => {
    const openingPattern = DEFAULT_SHIFT_PATTERNS.find(p => p.id === 'opening')!
    const midPattern = DEFAULT_SHIFT_PATTERNS.find(p => p.id === 'mid')!
    const closingPattern = DEFAULT_SHIFT_PATTERNS.find(p => p.id === 'closing')!
    const testDate = new Date('2024-01-15')

    describe('Opening shift', () => {
      it('should start at store opening time', () => {
        const result = calculateShiftTimes(openingPattern, '09:00', '22:00', testDate)

        expect(result.start.getHours()).toBe(9)
        expect(result.start.getMinutes()).toBe(0)
      })

      it('should end 8 hours after start', () => {
        const result = calculateShiftTimes(openingPattern, '09:00', '22:00', testDate)

        expect(result.end.getHours()).toBe(17) // 9 + 8
        expect(result.end.getMinutes()).toBe(0)
      })

      it('should handle early opening times', () => {
        const result = calculateShiftTimes(openingPattern, '06:00', '22:00', testDate)

        expect(result.start.getHours()).toBe(6)
        expect(result.end.getHours()).toBe(14)
      })
    })

    describe('Mid shift', () => {
      it('should start 4 hours after opening', () => {
        const result = calculateShiftTimes(midPattern, '09:00', '22:00', testDate)

        expect(result.start.getHours()).toBe(13) // 9 + 4
      })

      it('should end 8 hours after start', () => {
        const result = calculateShiftTimes(midPattern, '09:00', '22:00', testDate)

        expect(result.end.getHours()).toBe(21) // 13 + 8
      })
    })

    describe('Closing shift', () => {
      it('should start 8 hours before closing', () => {
        const result = calculateShiftTimes(closingPattern, '09:00', '22:00', testDate)

        expect(result.start.getHours()).toBe(14) // 22 - 8
      })

      it('should end at closing time', () => {
        const result = calculateShiftTimes(closingPattern, '09:00', '22:00', testDate)

        expect(result.end.getHours()).toBe(22)
      })

      it('should handle late closing times', () => {
        const result = calculateShiftTimes(closingPattern, '09:00', '23:00', testDate)

        expect(result.start.getHours()).toBe(15) // 23 - 8
        expect(result.end.getHours()).toBe(23)
      })
    })

    it('should preserve the date', () => {
      const result = calculateShiftTimes(openingPattern, '09:00', '22:00', testDate)

      expect(result.start.getDate()).toBe(15)
      expect(result.start.getMonth()).toBe(0) // January
      expect(result.start.getFullYear()).toBe(2024)
    })

    it('should handle times with minutes', () => {
      const result = calculateShiftTimes(openingPattern, '09:30', '22:30', testDate)

      expect(result.start.getHours()).toBe(9)
      expect(result.start.getMinutes()).toBe(30)
      expect(result.end.getHours()).toBe(17)
      expect(result.end.getMinutes()).toBe(30)
    })
  })

  describe('parseTime', () => {
    it('should parse standard time format', () => {
      const result = parseTime('09:30')

      expect(result.hours).toBe(9)
      expect(result.minutes).toBe(30)
    })

    it('should parse midnight', () => {
      const result = parseTime('00:00')

      expect(result.hours).toBe(0)
      expect(result.minutes).toBe(0)
    })

    it('should parse late evening time', () => {
      const result = parseTime('23:59')

      expect(result.hours).toBe(23)
      expect(result.minutes).toBe(59)
    })

    it('should parse noon', () => {
      const result = parseTime('12:00')

      expect(result.hours).toBe(12)
      expect(result.minutes).toBe(0)
    })
  })

  describe('formatShiftTime', () => {
    it('should format morning time with AM', () => {
      const date = new Date('2024-01-15T09:30:00')
      const result = formatShiftTime(date)

      expect(result).toMatch(/9:30\s*AM/i)
    })

    it('should format afternoon time with PM', () => {
      const date = new Date('2024-01-15T14:00:00')
      const result = formatShiftTime(date)

      expect(result).toMatch(/2:00\s*PM/i)
    })

    it('should format midnight', () => {
      const date = new Date('2024-01-15T00:00:00')
      const result = formatShiftTime(date)

      expect(result).toMatch(/12:00\s*AM/i)
    })

    it('should format noon', () => {
      const date = new Date('2024-01-15T12:00:00')
      const result = formatShiftTime(date)

      expect(result).toMatch(/12:00\s*PM/i)
    })
  })

  describe('calculateHours', () => {
    it('should calculate hours for standard 8-hour shift', () => {
      const start = new Date('2024-01-15T09:00:00')
      const end = new Date('2024-01-15T17:00:00')

      expect(calculateHours(start, end)).toBe(8)
    })

    it('should calculate hours for short shift', () => {
      const start = new Date('2024-01-15T09:00:00')
      const end = new Date('2024-01-15T13:00:00')

      expect(calculateHours(start, end)).toBe(4)
    })

    it('should calculate hours with minutes', () => {
      const start = new Date('2024-01-15T09:00:00')
      const end = new Date('2024-01-15T17:30:00')

      expect(calculateHours(start, end)).toBe(8.5)
    })

    it('should return 0 for same start and end', () => {
      const time = new Date('2024-01-15T09:00:00')

      expect(calculateHours(time, time)).toBe(0)
    })

    it('should handle overnight shifts', () => {
      const start = new Date('2024-01-15T20:00:00')
      const end = new Date('2024-01-16T04:00:00')

      expect(calculateHours(start, end)).toBe(8)
    })
  })

  describe('getWeekDates', () => {
    it('should return 7 dates', () => {
      const result = getWeekDates(new Date('2024-01-15'))

      expect(result).toHaveLength(7)
    })

    it('should start with Monday', () => {
      const result = getWeekDates(new Date('2024-01-15')) // Monday

      expect(result[0].getDay()).toBe(1) // Monday
    })

    it('should end with Sunday', () => {
      const result = getWeekDates(new Date('2024-01-15'))

      expect(result[6].getDay()).toBe(0) // Sunday
    })

    it('should handle dates starting on Sunday', () => {
      const result = getWeekDates(new Date('2024-01-14')) // Sunday

      expect(result[0].getDay()).toBe(1) // Should still start on Monday of previous week
    })

    it('should have consecutive dates', () => {
      const result = getWeekDates(new Date('2024-01-15'))

      for (let i = 1; i < result.length; i++) {
        const diff = result[i].getDate() - result[i - 1].getDate()
        // Handle month boundary
        expect(diff === 1 || diff < -25).toBe(true)
      }
    })
  })

  describe('formatWeekDay', () => {
    it('should format Monday correctly', () => {
      const result = formatWeekDay(new Date('2024-01-15'))

      expect(result.day).toBe('Mon')
      expect(result.date).toBe('Jan 15')
    })

    it('should format Friday correctly', () => {
      const result = formatWeekDay(new Date('2024-01-19'))

      expect(result.day).toBe('Fri')
      expect(result.date).toBe('Jan 19')
    })

    it('should format Sunday correctly', () => {
      const result = formatWeekDay(new Date('2024-01-21'))

      expect(result.day).toBe('Sun')
      expect(result.date).toBe('Jan 21')
    })
  })

  describe('isToday', () => {
    it('should return true for today', () => {
      expect(isToday(new Date())).toBe(true)
    })

    it('should return false for yesterday', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      expect(isToday(yesterday)).toBe(false)
    })

    it('should return false for tomorrow', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      expect(isToday(tomorrow)).toBe(false)
    })

    it('should return false for same day different year', () => {
      const lastYear = new Date()
      lastYear.setFullYear(lastYear.getFullYear() - 1)

      expect(isToday(lastYear)).toBe(false)
    })
  })

  describe('getPatternColor', () => {
    it('should return green for Opening', () => {
      expect(getPatternColor('Opening')).toBe('#22c55e')
    })

    it('should return blue for Mid', () => {
      expect(getPatternColor('Mid')).toBe('#3b82f6')
    })

    it('should return purple for Closing', () => {
      expect(getPatternColor('Closing')).toBe('#a855f7')
    })

    it('should be case-insensitive', () => {
      expect(getPatternColor('opening')).toBe('#22c55e')
      expect(getPatternColor('OPENING')).toBe('#22c55e')
      expect(getPatternColor('OpEnInG')).toBe('#22c55e')
    })

    it('should return default gray for unknown pattern', () => {
      expect(getPatternColor('Unknown')).toBe('#6b7280')
    })

    it('should return default gray for empty string', () => {
      expect(getPatternColor('')).toBe('#6b7280')
    })
  })

  describe('guessShiftPattern', () => {
    it('should guess opening for early morning start', () => {
      const startTime = new Date('2024-01-15T09:00:00')

      expect(guessShiftPattern(startTime, '09:00')).toBe('opening')
    })

    it('should guess opening within 1 hour tolerance', () => {
      const startTime = new Date('2024-01-15T10:00:00')

      expect(guessShiftPattern(startTime, '09:00')).toBe('opening')
    })

    it('should guess mid for afternoon start', () => {
      const startTime = new Date('2024-01-15T13:00:00') // 4 hours after 9am

      expect(guessShiftPattern(startTime, '09:00')).toBe('mid')
    })

    it('should guess closing for evening start', () => {
      const startTime = new Date('2024-01-15T16:00:00')

      expect(guessShiftPattern(startTime, '09:00')).toBe('closing')
    })

    it('should return custom when no store opening time', () => {
      const startTime = new Date('2024-01-15T09:00:00')

      expect(guessShiftPattern(startTime, null)).toBe('custom')
    })

    it('should return custom for unusual times', () => {
      const startTime = new Date('2024-01-15T11:00:00') // 2 hours after open

      expect(guessShiftPattern(startTime, '09:00')).toBe('custom')
    })
  })

  describe('getDayOfWeekKey', () => {
    it('should return monday for Monday date', () => {
      expect(getDayOfWeekKey(new Date('2024-01-15'))).toBe('monday')
    })

    it('should return tuesday for Tuesday date', () => {
      expect(getDayOfWeekKey(new Date('2024-01-16'))).toBe('tuesday')
    })

    it('should return wednesday for Wednesday date', () => {
      expect(getDayOfWeekKey(new Date('2024-01-17'))).toBe('wednesday')
    })

    it('should return thursday for Thursday date', () => {
      expect(getDayOfWeekKey(new Date('2024-01-18'))).toBe('thursday')
    })

    it('should return friday for Friday date', () => {
      expect(getDayOfWeekKey(new Date('2024-01-19'))).toBe('friday')
    })

    it('should return saturday for Saturday date', () => {
      expect(getDayOfWeekKey(new Date('2024-01-20'))).toBe('saturday')
    })

    it('should return sunday for Sunday date', () => {
      expect(getDayOfWeekKey(new Date('2024-01-21'))).toBe('sunday')
    })
  })

  describe('getStoreHoursForDate', () => {
    it('should return default hours when no weekly_hours configured', () => {
      const store = createMockStore()
      const date = new Date('2024-01-15')

      const result = getStoreHoursForDate(store, date)

      expect(result.openingTime).toBe('09:00')
      expect(result.closingTime).toBe('22:00')
      expect(result.isOpen).toBe(true)
    })

    it('should return day-specific hours when weekly_hours is configured', () => {
      const store = createMockStore({
        weekly_hours: {
          monday: { is_open: true, opening_time: '08:00', closing_time: '20:00' },
          tuesday: { is_open: true, opening_time: '09:00', closing_time: '22:00' },
          wednesday: { is_open: true, opening_time: '09:00', closing_time: '22:00' },
          thursday: { is_open: true, opening_time: '09:00', closing_time: '22:00' },
          friday: { is_open: true, opening_time: '09:00', closing_time: '23:00' },
          saturday: { is_open: true, opening_time: '10:00', closing_time: '23:00' },
          sunday: { is_open: false, opening_time: null, closing_time: null },
        },
      })
      const monday = new Date('2024-01-15')

      const result = getStoreHoursForDate(store, monday)

      expect(result.openingTime).toBe('08:00')
      expect(result.closingTime).toBe('20:00')
      expect(result.isOpen).toBe(true)
    })

    it('should indicate closed day', () => {
      const store = createMockStore({
        weekly_hours: {
          monday: { is_open: true, opening_time: '09:00', closing_time: '22:00' },
          tuesday: { is_open: true, opening_time: '09:00', closing_time: '22:00' },
          wednesday: { is_open: true, opening_time: '09:00', closing_time: '22:00' },
          thursday: { is_open: true, opening_time: '09:00', closing_time: '22:00' },
          friday: { is_open: true, opening_time: '09:00', closing_time: '22:00' },
          saturday: { is_open: true, opening_time: '10:00', closing_time: '22:00' },
          sunday: { is_open: false, opening_time: null, closing_time: null },
        },
      })
      const sunday = new Date('2024-01-21')

      const result = getStoreHoursForDate(store, sunday)

      expect(result.isOpen).toBe(false)
      expect(result.openingTime).toBeNull()
      expect(result.closingTime).toBeNull()
    })

    it('should return closed when default hours are not set', () => {
      const store = createMockStore({
        opening_time: null,
        closing_time: null,
        weekly_hours: null,
      })
      const date = new Date('2024-01-15')

      const result = getStoreHoursForDate(store, date)

      expect(result.isOpen).toBe(false)
    })
  })

  describe('hasStoreHoursForDate', () => {
    it('should return true when store has hours for that day', () => {
      const store = createMockStore()
      const date = new Date('2024-01-15')

      expect(hasStoreHoursForDate(store, date)).toBe(true)
    })

    it('should return false when store is closed that day', () => {
      const store = createMockStore({
        weekly_hours: {
          monday: { is_open: true, opening_time: '09:00', closing_time: '22:00' },
          tuesday: { is_open: true, opening_time: '09:00', closing_time: '22:00' },
          wednesday: { is_open: true, opening_time: '09:00', closing_time: '22:00' },
          thursday: { is_open: true, opening_time: '09:00', closing_time: '22:00' },
          friday: { is_open: true, opening_time: '09:00', closing_time: '22:00' },
          saturday: { is_open: true, opening_time: '10:00', closing_time: '22:00' },
          sunday: { is_open: false, opening_time: null, closing_time: null },
        },
      })
      const sunday = new Date('2024-01-21')

      expect(hasStoreHoursForDate(store, sunday)).toBe(false)
    })

    it('should return false when store has no hours configured', () => {
      const store = createMockStore({
        opening_time: null,
        closing_time: null,
        weekly_hours: null,
      })
      const date = new Date('2024-01-15')

      expect(hasStoreHoursForDate(store, date)).toBe(false)
    })
  })
})
