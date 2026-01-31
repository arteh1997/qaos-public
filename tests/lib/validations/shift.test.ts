import { describe, it, expect } from 'vitest'
import { shiftSchema, clockInOutSchema } from '@/lib/validations/shift'

// Valid UUIDs for testing
const validUuid = '123e4567-e89b-12d3-a456-426614174000'
const validUuid2 = '550e8400-e29b-41d4-a716-446655440000'

// Valid ISO datetime strings
const now = new Date()
const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)
const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000)
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

describe('Shift Validation Schemas', () => {
  describe('shiftSchema', () => {
    describe('Valid Inputs', () => {
      it('should accept valid shift with all required fields', () => {
        const result = shiftSchema.safeParse({
          store_id: validUuid,
          user_id: validUuid2,
          start_time: now.toISOString(),
          end_time: oneHourFromNow.toISOString(),
        })
        expect(result.success).toBe(true)
      })

      it('should accept shift with optional notes', () => {
        const result = shiftSchema.safeParse({
          store_id: validUuid,
          user_id: validUuid2,
          start_time: now.toISOString(),
          end_time: oneHourFromNow.toISOString(),
          notes: 'Opening shift',
        })
        expect(result.success).toBe(true)
      })

      it('should accept long shift duration', () => {
        const eightHoursFromNow = new Date(now.getTime() + 8 * 60 * 60 * 1000)
        const result = shiftSchema.safeParse({
          store_id: validUuid,
          user_id: validUuid2,
          start_time: now.toISOString(),
          end_time: eightHoursFromNow.toISOString(),
        })
        expect(result.success).toBe(true)
      })

      it('should accept shift in the past', () => {
        const pastStart = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const pastEnd = new Date(now.getTime() - 16 * 60 * 60 * 1000)
        const result = shiftSchema.safeParse({
          store_id: validUuid,
          user_id: validUuid2,
          start_time: pastStart.toISOString(),
          end_time: pastEnd.toISOString(),
        })
        expect(result.success).toBe(true)
      })

      it('should accept shift in the future', () => {
        const futureStart = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        const futureEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000)
        const result = shiftSchema.safeParse({
          store_id: validUuid,
          user_id: validUuid2,
          start_time: futureStart.toISOString(),
          end_time: futureEnd.toISOString(),
        })
        expect(result.success).toBe(true)
      })

      it('should accept minimum duration (1 millisecond difference)', () => {
        const start = new Date()
        const end = new Date(start.getTime() + 1)
        const result = shiftSchema.safeParse({
          store_id: validUuid,
          user_id: validUuid2,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
        })
        expect(result.success).toBe(true)
      })
    })

    describe('Invalid Inputs - End Time Validation', () => {
      it('should reject when end_time is before start_time', () => {
        const result = shiftSchema.safeParse({
          store_id: validUuid,
          user_id: validUuid2,
          start_time: oneHourFromNow.toISOString(),
          end_time: now.toISOString(),
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          const endTimeError = result.error.issues.find(
            (issue) => issue.path.includes('end_time')
          )
          expect(endTimeError?.message).toBe('End time must be after start time')
        }
      })

      it('should reject when end_time equals start_time', () => {
        const sameTime = now.toISOString()
        const result = shiftSchema.safeParse({
          store_id: validUuid,
          user_id: validUuid2,
          start_time: sameTime,
          end_time: sameTime,
        })
        expect(result.success).toBe(false)
      })
    })

    describe('Invalid Inputs - UUID Validation', () => {
      it('should reject invalid store_id UUID', () => {
        const result = shiftSchema.safeParse({
          store_id: 'not-a-uuid',
          user_id: validUuid,
          start_time: now.toISOString(),
          end_time: oneHourFromNow.toISOString(),
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Invalid store')
        }
      })

      it('should reject invalid user_id UUID', () => {
        const result = shiftSchema.safeParse({
          store_id: validUuid,
          user_id: 'bad-user-id',
          start_time: now.toISOString(),
          end_time: oneHourFromNow.toISOString(),
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Invalid user')
        }
      })

      it('should reject empty UUIDs', () => {
        expect(
          shiftSchema.safeParse({
            store_id: '',
            user_id: validUuid,
            start_time: now.toISOString(),
            end_time: oneHourFromNow.toISOString(),
          }).success
        ).toBe(false)

        expect(
          shiftSchema.safeParse({
            store_id: validUuid,
            user_id: '',
            start_time: now.toISOString(),
            end_time: oneHourFromNow.toISOString(),
          }).success
        ).toBe(false)
      })
    })

    describe('Invalid Inputs - Datetime Validation', () => {
      it('should reject completely invalid start_time', () => {
        const result = shiftSchema.safeParse({
          store_id: validUuid,
          user_id: validUuid2,
          start_time: 'not-a-date-at-all',
          end_time: oneHourFromNow.toISOString(),
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Invalid start time')
        }
      })

      it('should reject invalid end_time format', () => {
        const result = shiftSchema.safeParse({
          store_id: validUuid,
          user_id: validUuid2,
          start_time: now.toISOString(),
          end_time: 'tomorrow at 5pm', // Not a parseable date
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Invalid end time')
        }
      })

      it('should accept date-only strings (parsed as midnight)', () => {
        // JavaScript's Date can parse date-only strings
        // The schema allows any parseable date format
        const result = shiftSchema.safeParse({
          store_id: validUuid,
          user_id: validUuid2,
          start_time: '2024-01-15',
          end_time: '2024-01-16',
        })
        expect(result.success).toBe(true)
      })
    })

    describe('Invalid Inputs - Missing Fields', () => {
      it('should reject missing store_id', () => {
        const result = shiftSchema.safeParse({
          user_id: validUuid,
          start_time: now.toISOString(),
          end_time: oneHourFromNow.toISOString(),
        })
        expect(result.success).toBe(false)
      })

      it('should reject missing user_id', () => {
        const result = shiftSchema.safeParse({
          store_id: validUuid,
          start_time: now.toISOString(),
          end_time: oneHourFromNow.toISOString(),
        })
        expect(result.success).toBe(false)
      })

      it('should reject missing start_time', () => {
        const result = shiftSchema.safeParse({
          store_id: validUuid,
          user_id: validUuid2,
          end_time: oneHourFromNow.toISOString(),
        })
        expect(result.success).toBe(false)
      })

      it('should reject missing end_time', () => {
        const result = shiftSchema.safeParse({
          store_id: validUuid,
          user_id: validUuid2,
          start_time: now.toISOString(),
        })
        expect(result.success).toBe(false)
      })

      it('should reject empty object', () => {
        const result = shiftSchema.safeParse({})
        expect(result.success).toBe(false)
      })
    })
  })

  describe('clockInOutSchema', () => {
    describe('Valid Inputs', () => {
      it('should accept valid clock_in', () => {
        const result = clockInOutSchema.safeParse({
          shift_id: validUuid,
          action: 'clock_in',
        })
        expect(result.success).toBe(true)
      })

      it('should accept valid clock_out', () => {
        const result = clockInOutSchema.safeParse({
          shift_id: validUuid,
          action: 'clock_out',
        })
        expect(result.success).toBe(true)
      })
    })

    describe('Invalid Inputs', () => {
      it('should reject invalid shift_id UUID', () => {
        const result = clockInOutSchema.safeParse({
          shift_id: 'invalid',
          action: 'clock_in',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Invalid shift')
        }
      })

      it('should reject empty shift_id', () => {
        const result = clockInOutSchema.safeParse({
          shift_id: '',
          action: 'clock_in',
        })
        expect(result.success).toBe(false)
      })

      it('should reject invalid action', () => {
        const result = clockInOutSchema.safeParse({
          shift_id: validUuid,
          action: 'clock_break',
        })
        expect(result.success).toBe(false)
      })

      it('should reject case-sensitive action variations', () => {
        expect(
          clockInOutSchema.safeParse({
            shift_id: validUuid,
            action: 'CLOCK_IN',
          }).success
        ).toBe(false)

        expect(
          clockInOutSchema.safeParse({
            shift_id: validUuid,
            action: 'Clock_In',
          }).success
        ).toBe(false)
      })

      it('should reject missing shift_id', () => {
        const result = clockInOutSchema.safeParse({
          action: 'clock_in',
        })
        expect(result.success).toBe(false)
      })

      it('should reject missing action', () => {
        const result = clockInOutSchema.safeParse({
          shift_id: validUuid,
        })
        expect(result.success).toBe(false)
      })

      it('should reject empty object', () => {
        const result = clockInOutSchema.safeParse({})
        expect(result.success).toBe(false)
      })
    })
  })
})
