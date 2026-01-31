import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  acceptInviteSchema,
} from '@/lib/validations/auth'

describe('Auth Validation Schemas', () => {
  describe('loginSchema', () => {
    describe('Valid Inputs', () => {
      it('should accept valid email and password', () => {
        const result = loginSchema.safeParse({
          email: 'user@example.com',
          password: 'password123',
        })
        expect(result.success).toBe(true)
      })

      it('should accept password with exactly 6 characters', () => {
        const result = loginSchema.safeParse({
          email: 'user@example.com',
          password: '123456',
        })
        expect(result.success).toBe(true)
      })

      it('should accept complex email addresses', () => {
        const result = loginSchema.safeParse({
          email: 'user.name+tag@sub.example.com',
          password: 'password123',
        })
        expect(result.success).toBe(true)
      })
    })

    describe('Invalid Inputs', () => {
      it('should reject invalid email format', () => {
        const result = loginSchema.safeParse({
          email: 'not-an-email',
          password: 'password123',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Please enter a valid email address')
        }
      })

      it('should reject empty email', () => {
        const result = loginSchema.safeParse({
          email: '',
          password: 'password123',
        })
        expect(result.success).toBe(false)
      })

      it('should reject password shorter than 6 characters', () => {
        const result = loginSchema.safeParse({
          email: 'user@example.com',
          password: '12345',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Password must be at least 6 characters')
        }
      })

      it('should reject empty password', () => {
        const result = loginSchema.safeParse({
          email: 'user@example.com',
          password: '',
        })
        expect(result.success).toBe(false)
      })

      it('should reject missing fields', () => {
        expect(loginSchema.safeParse({}).success).toBe(false)
        expect(loginSchema.safeParse({ email: 'user@example.com' }).success).toBe(false)
        expect(loginSchema.safeParse({ password: 'password' }).success).toBe(false)
      })
    })
  })

  describe('forgotPasswordSchema', () => {
    describe('Valid Inputs', () => {
      it('should accept valid email', () => {
        const result = forgotPasswordSchema.safeParse({
          email: 'user@example.com',
        })
        expect(result.success).toBe(true)
      })
    })

    describe('Invalid Inputs', () => {
      it('should reject invalid email', () => {
        const result = forgotPasswordSchema.safeParse({
          email: 'invalid',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Please enter a valid email address')
        }
      })

      it('should reject empty email', () => {
        const result = forgotPasswordSchema.safeParse({
          email: '',
        })
        expect(result.success).toBe(false)
      })

      it('should reject missing email', () => {
        const result = forgotPasswordSchema.safeParse({})
        expect(result.success).toBe(false)
      })
    })
  })

  describe('resetPasswordSchema', () => {
    describe('Valid Inputs', () => {
      it('should accept matching passwords', () => {
        const result = resetPasswordSchema.safeParse({
          password: 'newPassword123',
          confirmPassword: 'newPassword123',
        })
        expect(result.success).toBe(true)
      })

      it('should accept passwords with exactly 6 characters', () => {
        const result = resetPasswordSchema.safeParse({
          password: '123456',
          confirmPassword: '123456',
        })
        expect(result.success).toBe(true)
      })
    })

    describe('Invalid Inputs', () => {
      it('should reject non-matching passwords', () => {
        const result = resetPasswordSchema.safeParse({
          password: 'password123',
          confirmPassword: 'differentPassword',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          const confirmError = result.error.issues.find(
            (issue) => issue.path.includes('confirmPassword')
          )
          expect(confirmError?.message).toBe("Passwords don't match")
        }
      })

      it('should reject passwords shorter than 6 characters', () => {
        const result = resetPasswordSchema.safeParse({
          password: '12345',
          confirmPassword: '12345',
        })
        expect(result.success).toBe(false)
      })

      it('should reject missing fields', () => {
        expect(resetPasswordSchema.safeParse({}).success).toBe(false)
        expect(
          resetPasswordSchema.safeParse({ password: 'password123' }).success
        ).toBe(false)
      })
    })
  })

  describe('acceptInviteSchema', () => {
    describe('Valid Inputs', () => {
      it('should accept valid invite acceptance', () => {
        const result = acceptInviteSchema.safeParse({
          password: 'newPassword123',
          confirmPassword: 'newPassword123',
          fullName: 'John Doe',
        })
        expect(result.success).toBe(true)
      })

      it('should accept minimum length name (2 characters)', () => {
        const result = acceptInviteSchema.safeParse({
          password: 'password123',
          confirmPassword: 'password123',
          fullName: 'Jo',
        })
        expect(result.success).toBe(true)
      })
    })

    describe('Invalid Inputs', () => {
      it('should reject non-matching passwords', () => {
        const result = acceptInviteSchema.safeParse({
          password: 'password123',
          confirmPassword: 'different',
          fullName: 'John Doe',
        })
        expect(result.success).toBe(false)
      })

      it('should reject full name shorter than 2 characters', () => {
        const result = acceptInviteSchema.safeParse({
          password: 'password123',
          confirmPassword: 'password123',
          fullName: 'J',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe(
            'Full name must be at least 2 characters'
          )
        }
      })

      it('should reject empty full name', () => {
        const result = acceptInviteSchema.safeParse({
          password: 'password123',
          confirmPassword: 'password123',
          fullName: '',
        })
        expect(result.success).toBe(false)
      })

      it('should reject missing fields', () => {
        expect(acceptInviteSchema.safeParse({}).success).toBe(false)
        expect(
          acceptInviteSchema.safeParse({
            password: 'password123',
            confirmPassword: 'password123',
          }).success
        ).toBe(false)
      })
    })
  })
})
