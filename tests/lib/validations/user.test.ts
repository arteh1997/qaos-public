import { describe, it, expect } from 'vitest'
import { inviteUserSchema, updateUserSchema } from '@/lib/validations/user'

describe('User Validation Schemas', () => {
  describe('inviteUserSchema', () => {
    describe('Valid Inputs', () => {
      it('should accept valid Admin invite without storeId', () => {
        const result = inviteUserSchema.safeParse({
          email: 'admin@example.com',
          fullName: 'Admin User',
          role: 'Admin',
        })
        expect(result.success).toBe(true)
      })

      it('should accept valid Driver invite without storeId', () => {
        const result = inviteUserSchema.safeParse({
          email: 'driver@example.com',
          fullName: 'Driver User',
          role: 'Driver',
        })
        expect(result.success).toBe(true)
      })

      it('should accept Admin with optional storeId', () => {
        const result = inviteUserSchema.safeParse({
          email: 'admin@example.com',
          fullName: 'Admin User',
          role: 'Admin',
          storeId: 'store-123',
        })
        expect(result.success).toBe(true)
      })

      it('should accept Staff with storeId', () => {
        const result = inviteUserSchema.safeParse({
          email: 'staff@example.com',
          fullName: 'Staff User',
          role: 'Staff',
          storeId: 'store-456',
        })
        expect(result.success).toBe(true)
      })

      it('should accept minimum length fullName (2 characters)', () => {
        const result = inviteUserSchema.safeParse({
          email: 'user@example.com',
          fullName: 'Jo',
          role: 'Admin',
        })
        expect(result.success).toBe(true)
      })

      it('should accept complex email addresses', () => {
        const result = inviteUserSchema.safeParse({
          email: 'user.name+tag@company.co.uk',
          fullName: 'Test User',
          role: 'Driver',
        })
        expect(result.success).toBe(true)
      })
    })

    describe('Invalid Inputs', () => {
      it('should reject Staff without storeId', () => {
        const result = inviteUserSchema.safeParse({
          email: 'staff@example.com',
          fullName: 'Staff User',
          role: 'Staff',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          const storeError = result.error.issues.find(
            (issue) => issue.path.includes('storeId')
          )
          expect(storeError?.message).toBe(
            'Staff members must be assigned to a store'
          )
        }
      })

      it('should reject invalid email', () => {
        const result = inviteUserSchema.safeParse({
          email: 'not-an-email',
          fullName: 'Test User',
          role: 'Admin',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe(
            'Please enter a valid email address'
          )
        }
      })

      it('should reject empty email', () => {
        const result = inviteUserSchema.safeParse({
          email: '',
          fullName: 'Test User',
          role: 'Admin',
        })
        expect(result.success).toBe(false)
      })

      it('should reject fullName shorter than 2 characters', () => {
        const result = inviteUserSchema.safeParse({
          email: 'user@example.com',
          fullName: 'J',
          role: 'Admin',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe(
            'Full name must be at least 2 characters'
          )
        }
      })

      it('should reject invalid role', () => {
        const result = inviteUserSchema.safeParse({
          email: 'user@example.com',
          fullName: 'Test User',
          role: 'Manager', // Invalid role
        })
        expect(result.success).toBe(false)
      })

      it('should reject missing required fields', () => {
        expect(inviteUserSchema.safeParse({}).success).toBe(false)
        expect(
          inviteUserSchema.safeParse({ email: 'test@test.com' }).success
        ).toBe(false)
        expect(
          inviteUserSchema.safeParse({
            email: 'test@test.com',
            fullName: 'Test',
          }).success
        ).toBe(false)
      })

      it('should reject Staff with empty string storeId', () => {
        const result = inviteUserSchema.safeParse({
          email: 'staff@example.com',
          fullName: 'Staff User',
          role: 'Staff',
          storeId: '',
        })
        // Empty string is falsy, so Staff validation will fail
        expect(result.success).toBe(false)
      })
    })

    describe('Role Validation', () => {
      it('should accept exactly Admin role', () => {
        const result = inviteUserSchema.safeParse({
          email: 'test@example.com',
          fullName: 'Test User',
          role: 'Admin',
        })
        expect(result.success).toBe(true)
      })

      it('should accept exactly Driver role', () => {
        const result = inviteUserSchema.safeParse({
          email: 'test@example.com',
          fullName: 'Test User',
          role: 'Driver',
        })
        expect(result.success).toBe(true)
      })

      it('should accept exactly Staff role with store', () => {
        const result = inviteUserSchema.safeParse({
          email: 'test@example.com',
          fullName: 'Test User',
          role: 'Staff',
          storeId: 'store-id',
        })
        expect(result.success).toBe(true)
      })

      it('should reject case-sensitive role variations', () => {
        expect(
          inviteUserSchema.safeParse({
            email: 'test@example.com',
            fullName: 'Test User',
            role: 'admin', // lowercase
          }).success
        ).toBe(false)

        expect(
          inviteUserSchema.safeParse({
            email: 'test@example.com',
            fullName: 'Test User',
            role: 'ADMIN', // uppercase
          }).success
        ).toBe(false)
      })
    })
  })

  describe('updateUserSchema', () => {
    describe('Valid Inputs', () => {
      it('should accept empty update (all fields optional)', () => {
        const result = updateUserSchema.safeParse({})
        expect(result.success).toBe(true)
      })

      it('should accept updating only fullName', () => {
        const result = updateUserSchema.safeParse({
          fullName: 'New Name',
        })
        expect(result.success).toBe(true)
      })

      it('should accept updating only role', () => {
        const result = updateUserSchema.safeParse({
          role: 'Driver',
        })
        expect(result.success).toBe(true)
      })

      it('should accept updating only status', () => {
        const result = updateUserSchema.safeParse({
          status: 'Active',
        })
        expect(result.success).toBe(true)
      })

      it('should accept updating storeId to null', () => {
        const result = updateUserSchema.safeParse({
          storeId: null,
        })
        expect(result.success).toBe(true)
      })

      it('should accept updating storeId to a value', () => {
        const result = updateUserSchema.safeParse({
          storeId: 'new-store-id',
        })
        expect(result.success).toBe(true)
      })

      it('should accept updating multiple fields', () => {
        const result = updateUserSchema.safeParse({
          fullName: 'Updated Name',
          role: 'Staff',
          storeId: 'store-123',
          status: 'Inactive',
        })
        expect(result.success).toBe(true)
      })

      it('should accept all valid status values', () => {
        expect(updateUserSchema.safeParse({ status: 'Invited' }).success).toBe(
          true
        )
        expect(updateUserSchema.safeParse({ status: 'Active' }).success).toBe(
          true
        )
        expect(updateUserSchema.safeParse({ status: 'Inactive' }).success).toBe(
          true
        )
      })

      it('should accept all valid role values', () => {
        expect(updateUserSchema.safeParse({ role: 'Admin' }).success).toBe(true)
        expect(updateUserSchema.safeParse({ role: 'Driver' }).success).toBe(true)
        expect(updateUserSchema.safeParse({ role: 'Staff' }).success).toBe(true)
      })
    })

    describe('Invalid Inputs', () => {
      it('should reject fullName shorter than 2 characters when provided', () => {
        const result = updateUserSchema.safeParse({
          fullName: 'A',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe(
            'Full name must be at least 2 characters'
          )
        }
      })

      it('should reject invalid role', () => {
        const result = updateUserSchema.safeParse({
          role: 'SuperAdmin',
        })
        expect(result.success).toBe(false)
      })

      it('should reject invalid status', () => {
        const result = updateUserSchema.safeParse({
          status: 'Pending',
        })
        expect(result.success).toBe(false)
      })

      it('should reject case-sensitive status variations', () => {
        expect(updateUserSchema.safeParse({ status: 'active' }).success).toBe(
          false
        )
        expect(updateUserSchema.safeParse({ status: 'ACTIVE' }).success).toBe(
          false
        )
      })
    })

    describe('Edge Cases', () => {
      it('should accept minimum valid fullName (2 characters)', () => {
        const result = updateUserSchema.safeParse({
          fullName: 'Jo',
        })
        expect(result.success).toBe(true)
      })

      it('should handle undefined storeId differently from null', () => {
        // undefined means don't update the field
        const undefinedResult = updateUserSchema.safeParse({
          storeId: undefined,
        })
        expect(undefinedResult.success).toBe(true)

        // null means set to null (unassign store)
        const nullResult = updateUserSchema.safeParse({
          storeId: null,
        })
        expect(nullResult.success).toBe(true)
      })
    })
  })
})
