import { describe, it, expect } from 'vitest'
import { inviteUserSchema, legacyInviteUserSchema, updateUserSchema, onboardingSchema } from '@/lib/validations/user'

describe('User Validation Schemas', () => {
  describe('inviteUserSchema', () => {
    describe('Valid Inputs', () => {
      it('should accept valid Owner invite with storeId', () => {
        const result = inviteUserSchema.safeParse({
          email: 'owner@example.com',
          role: 'Owner',
          storeId: 'store-123',
        })
        expect(result.success).toBe(true)
      })

      it('should accept Staff with storeId', () => {
        const result = inviteUserSchema.safeParse({
          email: 'staff@example.com',
          role: 'Staff',
          storeId: 'store-456',
        })
        expect(result.success).toBe(true)
      })

      it('should accept Manager with storeId', () => {
        const result = inviteUserSchema.safeParse({
          email: 'manager@example.com',
          role: 'Manager',
          storeId: 'store-789',
        })
        expect(result.success).toBe(true)
      })

      it('should accept complex email addresses', () => {
        const result = inviteUserSchema.safeParse({
          email: 'user.name+tag@company.co.uk',
          role: 'Staff',
          storeId: 'store-id',
        })
        expect(result.success).toBe(true)
      })
    })

    describe('Invalid Inputs', () => {
      it('should reject Owner without storeId', () => {
        const result = inviteUserSchema.safeParse({
          email: 'owner@example.com',
          role: 'Owner',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          const storeError = result.error.issues.find(
            (issue) => issue.path.includes('storeId')
          )
          expect(storeError?.message).toBe('Please select a store')
        }
      })

      it('should reject Staff without storeId', () => {
        const result = inviteUserSchema.safeParse({
          email: 'staff@example.com',
          role: 'Staff',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          const storeError = result.error.issues.find(
            (issue) => issue.path.includes('storeId')
          )
          expect(storeError?.message).toBe('Please select a store')
        }
      })

      it('should reject Manager without storeId', () => {
        const result = inviteUserSchema.safeParse({
          email: 'manager@example.com',
          role: 'Manager',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          const storeError = result.error.issues.find(
            (issue) => issue.path.includes('storeId')
          )
          expect(storeError?.message).toBe('Please select a store')
        }
      })

      it('should reject invalid email', () => {
        const result = inviteUserSchema.safeParse({
          email: 'not-an-email',
          role: 'Staff',
          storeId: 'store-id',
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
          role: 'Staff',
          storeId: 'store-id',
        })
        expect(result.success).toBe(false)
      })

      it('should reject invalid role', () => {
        const result = inviteUserSchema.safeParse({
          email: 'user@example.com',
          role: 'Admin', // Admin is now a legacy role, not valid for invites
        })
        expect(result.success).toBe(false)
      })

      it('should reject missing required fields', () => {
        expect(inviteUserSchema.safeParse({}).success).toBe(false)
        expect(
          inviteUserSchema.safeParse({ email: 'test@test.com' }).success
        ).toBe(false)
      })

      it('should reject Staff with empty string storeId', () => {
        const result = inviteUserSchema.safeParse({
          email: 'staff@example.com',
          role: 'Staff',
          storeId: '',
        })
        // Empty string is falsy, so Staff validation will fail
        expect(result.success).toBe(false)
      })
    })

    describe('Role Validation', () => {
      it('should accept exactly Owner role with store', () => {
        const result = inviteUserSchema.safeParse({
          email: 'test@example.com',
          role: 'Owner',
          storeId: 'store-id',
        })
        expect(result.success).toBe(true)
      })

      it('should accept exactly Manager role with store', () => {
        const result = inviteUserSchema.safeParse({
          email: 'test@example.com',
          role: 'Manager',
          storeId: 'store-id',
        })
        expect(result.success).toBe(true)
      })

      it('should accept exactly Staff role with store', () => {
        const result = inviteUserSchema.safeParse({
          email: 'test@example.com',
          role: 'Staff',
          storeId: 'store-id',
        })
        expect(result.success).toBe(true)
      })

      it('should reject case-sensitive role variations', () => {
        expect(
          inviteUserSchema.safeParse({
            email: 'test@example.com',
            role: 'owner', // lowercase
          }).success
        ).toBe(false)

        expect(
          inviteUserSchema.safeParse({
            email: 'test@example.com',
            role: 'OWNER', // uppercase
          }).success
        ).toBe(false)
      })
    })
  })

  describe('legacyInviteUserSchema', () => {
    it('should accept valid input with fullName', () => {
      const result = legacyInviteUserSchema.safeParse({
        email: 'owner@example.com',
        fullName: 'Owner User',
        role: 'Owner',
        storeId: 'store-123',
      })
      expect(result.success).toBe(true)
    })

    it('should reject Driver role (no longer valid)', () => {
      const result = legacyInviteUserSchema.safeParse({
        email: 'user@example.com',
        fullName: 'Test User',
        role: 'Driver',
        storeId: 'store-123',
      })
      expect(result.success).toBe(false)
    })

    it('should reject fullName shorter than 2 characters', () => {
      const result = legacyInviteUserSchema.safeParse({
        email: 'user@example.com',
        fullName: 'J',
        role: 'Staff',
        storeId: 'store-id',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'Full name must be at least 2 characters'
        )
      }
    })

    it('should reject Owner without storeId', () => {
      const result = legacyInviteUserSchema.safeParse({
        email: 'owner@example.com',
        fullName: 'Owner User',
        role: 'Owner',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('onboardingSchema', () => {
    it('should accept valid onboarding data', () => {
      const result = onboardingSchema.safeParse({
        token: 'valid-token-123',
        firstName: 'John',
        lastName: 'Doe',
        password: 'Password1',
        confirmPassword: 'Password1',
      })
      expect(result.success).toBe(true)
    })

    it('should accept onboarding data with phone', () => {
      const result = onboardingSchema.safeParse({
        token: 'valid-token-123',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        password: 'Password1',
        confirmPassword: 'Password1',
      })
      expect(result.success).toBe(true)
    })

    it('should reject mismatched passwords', () => {
      const result = onboardingSchema.safeParse({
        token: 'valid-token-123',
        firstName: 'John',
        lastName: 'Doe',
        password: 'Password1',
        confirmPassword: 'Password2',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const passwordError = result.error.issues.find(
          (issue) => issue.path.includes('confirmPassword')
        )
        expect(passwordError?.message).toBe('Passwords do not match')
      }
    })

    it('should reject password without uppercase', () => {
      const result = onboardingSchema.safeParse({
        token: 'valid-token-123',
        firstName: 'John',
        lastName: 'Doe',
        password: 'password1',
        confirmPassword: 'password1',
      })
      expect(result.success).toBe(false)
    })

    it('should reject password without lowercase', () => {
      const result = onboardingSchema.safeParse({
        token: 'valid-token-123',
        firstName: 'John',
        lastName: 'Doe',
        password: 'PASSWORD1',
        confirmPassword: 'PASSWORD1',
      })
      expect(result.success).toBe(false)
    })

    it('should reject password without number', () => {
      const result = onboardingSchema.safeParse({
        token: 'valid-token-123',
        firstName: 'John',
        lastName: 'Doe',
        password: 'Password',
        confirmPassword: 'Password',
      })
      expect(result.success).toBe(false)
    })

    it('should reject password shorter than 8 characters', () => {
      const result = onboardingSchema.safeParse({
        token: 'valid-token-123',
        firstName: 'John',
        lastName: 'Doe',
        password: 'Pass1',
        confirmPassword: 'Pass1',
      })
      expect(result.success).toBe(false)
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
          role: 'Staff',
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
        expect(updateUserSchema.safeParse({ role: 'Owner' }).success).toBe(true)
        expect(updateUserSchema.safeParse({ role: 'Manager' }).success).toBe(true)
        expect(updateUserSchema.safeParse({ role: 'Staff' }).success).toBe(true)
      })

      it('should reject Driver role (no longer valid)', () => {
        expect(updateUserSchema.safeParse({ role: 'Driver' }).success).toBe(false)
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

      it('should reject legacy Admin role', () => {
        const result = updateUserSchema.safeParse({
          role: 'Admin',
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
