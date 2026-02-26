import { describe, it, expect } from 'vitest'
import {
  bulkUserRowSchema,
  bulkImportSchema,
  parseUserCSV,
  generateCSVTemplate,
} from '@/lib/validations/bulk-import'

// Valid UUID for testing
const validUuid = '550e8400-e29b-41d4-a716-446655440000'

describe('Bulk Import Validation', () => {
  describe('bulkUserRowSchema', () => {
    describe('Valid Inputs', () => {
      it('should accept valid user with all fields', () => {
        const result = bulkUserRowSchema.safeParse({
          email: 'user@example.com',
          role: 'Staff',
          storeId: validUuid,
        })
        expect(result.success).toBe(true)
      })

      it('should accept all valid roles', () => {
        const roles = ['Owner', 'Manager', 'Staff']
        for (const role of roles) {
          const result = bulkUserRowSchema.safeParse({
            email: `test-${role.toLowerCase()}@example.com`,
            role,
          })
          expect(result.success).toBe(true)
        }
      })
    })

    describe('Invalid Inputs', () => {
      it('should reject invalid email', () => {
        const result = bulkUserRowSchema.safeParse({
          email: 'not-an-email',
          role: 'Staff',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Invalid email address')
        }
      })

      it('should reject empty email', () => {
        const result = bulkUserRowSchema.safeParse({
          email: '',
          role: 'Staff',
        })
        expect(result.success).toBe(false)
      })

      it('should reject invalid role', () => {
        const result = bulkUserRowSchema.safeParse({
          email: 'user@example.com',
          role: 'SuperAdmin',
        })
        expect(result.success).toBe(false)
      })

      it('should reject invalid storeId UUID', () => {
        const result = bulkUserRowSchema.safeParse({
          email: 'user@example.com',
          role: 'Staff',
          storeId: 'not-a-uuid',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Invalid store ID')
        }
      })

      it('should reject missing role', () => {
        const result = bulkUserRowSchema.safeParse({
          email: 'user@example.com',
        })
        expect(result.success).toBe(false)
      })
    })
  })

  describe('bulkImportSchema', () => {
    describe('Valid Inputs', () => {
      it('should accept valid import with multiple users', () => {
        const result = bulkImportSchema.safeParse({
          users: [
            { email: 'user1@example.com', role: 'Staff' },
            { email: 'user2@example.com', role: 'Manager' },
            { email: 'user3@example.com', role: 'Staff' },
          ],
        })
        expect(result.success).toBe(true)
      })

      it('should accept with defaultStoreId', () => {
        const result = bulkImportSchema.safeParse({
          users: [{ email: 'user@example.com', role: 'Staff' }],
          defaultStoreId: validUuid,
        })
        expect(result.success).toBe(true)
      })

      it('should accept exactly 50 users (maximum)', () => {
        const users = Array.from({ length: 50 }, (_, i) => ({
          email: `user${i}@example.com`,
          role: 'Staff' as const,
        }))
        const result = bulkImportSchema.safeParse({ users })
        expect(result.success).toBe(true)
      })
    })

    describe('Invalid Inputs', () => {
      it('should reject empty users array', () => {
        const result = bulkImportSchema.safeParse({
          users: [],
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('At least one user is required')
        }
      })

      it('should reject more than 50 users', () => {
        const users = Array.from({ length: 51 }, (_, i) => ({
          email: `user${i}@example.com`,
          role: 'Staff' as const,
        }))
        const result = bulkImportSchema.safeParse({ users })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Maximum 50 users per import')
        }
      })

      it('should reject invalid defaultStoreId', () => {
        const result = bulkImportSchema.safeParse({
          users: [{ email: 'user@example.com', role: 'Staff' }],
          defaultStoreId: 'invalid-uuid',
        })
        expect(result.success).toBe(false)
      })
    })
  })

  describe('parseUserCSV', () => {
    it('should parse valid CSV without header', () => {
      const csv = `john@example.com,Staff,
jane@example.com,Manager,`

      const { users, errors } = parseUserCSV(csv)

      expect(errors).toHaveLength(0)
      expect(users).toHaveLength(2)
      expect(users[0].email).toBe('john@example.com')
      expect(users[0].role).toBe('Staff')
      expect(users[1].email).toBe('jane@example.com')
      expect(users[1].role).toBe('Manager')
    })

    it('should skip header row if present', () => {
      const csv = `email,role,storeId
john@example.com,Staff,
jane@example.com,Manager,`

      const { users, errors } = parseUserCSV(csv)

      expect(errors).toHaveLength(0)
      expect(users).toHaveLength(2)
      expect(users[0].email).toBe('john@example.com')
    })

    it('should default role to Staff when not specified', () => {
      const csv = `user@example.com,,`

      const { users, errors } = parseUserCSV(csv)

      expect(errors).toHaveLength(0)
      expect(users).toHaveLength(1)
      expect(users[0].role).toBe('Staff')
    })

    it('should handle storeId column', () => {
      const csv = `user@example.com,Staff,${validUuid}`

      const { users, errors } = parseUserCSV(csv)

      expect(errors).toHaveLength(0)
      expect(users).toHaveLength(1)
      expect(users[0].storeId).toBe(validUuid)
    })

    it('should report error for missing email', () => {
      const csv = `,Staff,`

      const { users, errors } = parseUserCSV(csv)

      expect(users).toHaveLength(0)
      expect(errors).toHaveLength(1)
      expect(errors[0].row).toBe(1)
      expect(errors[0].message).toBe('Email is required')
    })

    it('should report error for invalid email', () => {
      const csv = `not-an-email,Staff,`

      const { users, errors } = parseUserCSV(csv)

      expect(users).toHaveLength(0)
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toContain('Invalid email')
    })

    it('should report error for invalid role', () => {
      const csv = `user@example.com,Admin,`

      const { users, errors } = parseUserCSV(csv)

      expect(users).toHaveLength(0)
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toContain('Role must be one of')
    })

    it('should handle quoted values', () => {
      const csv = `"john.doe@example.com",Staff,`

      const { users, errors } = parseUserCSV(csv)

      expect(errors).toHaveLength(0)
      expect(users).toHaveLength(1)
      expect(users[0].email).toBe('john.doe@example.com')
    })

    it('should handle escaped quotes', () => {
      const csv = `"john""test""@example.com",Staff,`

      const { users, errors } = parseUserCSV(csv)

      // Should still fail validation because the email is invalid
      expect(errors.length).toBeGreaterThan(0)
    })

    it('should skip empty lines', () => {
      const csv = `john@example.com,Staff,

jane@example.com,Manager,`

      const { users, errors } = parseUserCSV(csv)

      expect(errors).toHaveLength(0)
      expect(users).toHaveLength(2)
    })

    it('should convert email to lowercase', () => {
      const csv = `JOHN@EXAMPLE.COM,Staff,`

      const { users, errors } = parseUserCSV(csv)

      expect(errors).toHaveLength(0)
      expect(users[0].email).toBe('john@example.com')
    })

    it('should trim whitespace', () => {
      const csv = `  john@example.com  ,  Staff  ,`

      const { users, errors } = parseUserCSV(csv)

      expect(errors).toHaveLength(0)
      expect(users[0].email).toBe('john@example.com')
      expect(users[0].role).toBe('Staff')
    })

    it('should collect multiple errors', () => {
      const csv = `invalid-email,Staff,
,Manager,
user@example.com,BadRole,`

      const { users, errors } = parseUserCSV(csv)

      expect(users).toHaveLength(0)
      expect(errors).toHaveLength(3)
      expect(errors[0].row).toBe(1)
      expect(errors[1].row).toBe(2)
      expect(errors[2].row).toBe(3)
    })
  })

  describe('generateCSVTemplate', () => {
    it('should generate a valid CSV template', () => {
      const template = generateCSVTemplate()

      expect(template).toContain('email,role,storeId')
      expect(template).toContain('Staff')
      expect(template).toContain('Manager')
    })

    it('should generate valid example emails', () => {
      const template = generateCSVTemplate()

      expect(template).toContain('@example.com')
    })

    it('should have header row', () => {
      const template = generateCSVTemplate()
      const lines = template.split('\n')

      expect(lines[0]).toBe('email,role,storeId')
    })
  })
})
