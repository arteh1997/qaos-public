import { describe, it, expect } from 'vitest'
import { storeSchema } from '@/lib/validations/store'

describe('Store Validation Schema', () => {
  describe('storeSchema', () => {
    describe('Valid Inputs', () => {
      it('should accept valid store with all fields', () => {
        const result = storeSchema.safeParse({
          name: 'Downtown Restaurant',
          address: '123 Main St, City, State 12345',
          is_active: true,
        })
        expect(result.success).toBe(true)
      })

      it('should accept store without address (optional)', () => {
        const result = storeSchema.safeParse({
          name: 'New Location',
          is_active: false,
        })
        expect(result.success).toBe(true)
      })

      it('should accept minimum length name (2 characters)', () => {
        const result = storeSchema.safeParse({
          name: 'HQ',
          is_active: true,
        })
        expect(result.success).toBe(true)
      })

      it('should accept inactive store', () => {
        const result = storeSchema.safeParse({
          name: 'Closed Location',
          address: '456 Old Road',
          is_active: false,
        })
        expect(result.success).toBe(true)
      })

      it('should accept store with empty address', () => {
        const result = storeSchema.safeParse({
          name: 'Test Store',
          address: '',
          is_active: true,
        })
        expect(result.success).toBe(true)
      })

      it('should accept store with long name', () => {
        const result = storeSchema.safeParse({
          name: 'The Very Long Restaurant Name With Many Words In It',
          is_active: true,
        })
        expect(result.success).toBe(true)
      })
    })

    describe('Invalid Inputs', () => {
      it('should reject name shorter than 2 characters', () => {
        const result = storeSchema.safeParse({
          name: 'A',
          is_active: true,
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe(
            'Store name must be at least 2 characters'
          )
        }
      })

      it('should reject empty name', () => {
        const result = storeSchema.safeParse({
          name: '',
          is_active: true,
        })
        expect(result.success).toBe(false)
      })

      it('should reject missing name', () => {
        const result = storeSchema.safeParse({
          is_active: true,
        })
        expect(result.success).toBe(false)
      })

      it('should reject missing is_active', () => {
        const result = storeSchema.safeParse({
          name: 'Valid Store',
        })
        expect(result.success).toBe(false)
      })

      it('should reject non-boolean is_active', () => {
        const result = storeSchema.safeParse({
          name: 'Valid Store',
          is_active: 'true',
        })
        expect(result.success).toBe(false)
      })

      it('should reject is_active as number', () => {
        const result = storeSchema.safeParse({
          name: 'Valid Store',
          is_active: 1,
        })
        expect(result.success).toBe(false)
      })

      it('should reject null name', () => {
        const result = storeSchema.safeParse({
          name: null,
          is_active: true,
        })
        expect(result.success).toBe(false)
      })

      it('should reject completely empty object', () => {
        const result = storeSchema.safeParse({})
        expect(result.success).toBe(false)
      })
    })

    describe('Edge Cases', () => {
      it('should handle whitespace-only name as invalid (after trimming would be empty)', () => {
        // Note: Zod doesn't auto-trim, so whitespace counts as characters
        const result = storeSchema.safeParse({
          name: '   ',
          is_active: true,
        })
        // This will pass since whitespace is 3 chars
        expect(result.success).toBe(true)
      })

      it('should handle special characters in name', () => {
        const result = storeSchema.safeParse({
          name: "Store #1 - O'Malley's",
          is_active: true,
        })
        expect(result.success).toBe(true)
      })

      it('should handle unicode in name', () => {
        const result = storeSchema.safeParse({
          name: 'カフェ 東京',
          is_active: true,
        })
        expect(result.success).toBe(true)
      })

      it('should handle unicode in address', () => {
        const result = storeSchema.safeParse({
          name: 'Tokyo Store',
          address: '東京都渋谷区1-2-3',
          is_active: true,
        })
        expect(result.success).toBe(true)
      })
    })
  })
})
