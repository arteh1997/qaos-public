import { z } from 'zod'
import { ROLES } from '@/lib/constants'

/**
 * Schema for a single user in bulk import CSV
 */
export const bulkUserRowSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['Owner', 'Manager', 'Staff', 'Driver'], {
    message: `Role must be one of: ${ROLES.join(', ')}`
  }),
  storeId: z.string().uuid('Invalid store ID').optional(),
})

export type BulkUserRow = z.infer<typeof bulkUserRowSchema>

/**
 * Schema for the bulk import request
 */
export const bulkImportSchema = z.object({
  users: z.array(bulkUserRowSchema).min(1, 'At least one user is required').max(50, 'Maximum 50 users per import'),
  defaultStoreId: z.string().uuid('Invalid default store ID').optional(),
})

export type BulkImportData = z.infer<typeof bulkImportSchema>

/**
 * Parse CSV content into user rows
 */
export function parseUserCSV(csvContent: string): {
  users: BulkUserRow[]
  errors: { row: number; message: string }[]
} {
  const lines = csvContent.trim().split('\n')
  const users: BulkUserRow[] = []
  const errors: { row: number; message: string }[] = []

  // Skip header row if present
  const startRow = lines[0]?.toLowerCase().includes('email') ? 1 : 0

  for (let i = startRow; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Parse CSV line (handles quoted values)
    const columns = parseCSVLine(line)
    const [email, role, storeId] = columns

    if (!email) {
      errors.push({ row: i + 1, message: 'Email is required' })
      continue
    }

    const rowData = {
      email: email.trim().toLowerCase(),
      role: role?.trim() || 'Staff',
      storeId: storeId?.trim() || undefined,
    }

    const result = bulkUserRowSchema.safeParse(rowData)

    if (result.success) {
      users.push(result.data)
    } else {
      errors.push({
        row: i + 1,
        message: result.error.issues.map(e => e.message).join(', ')
      })
    }
  }

  return { users, errors }
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"' && inQuotes && nextChar === '"') {
      // Escaped quote
      current += '"'
      i++
    } else if (char === '"') {
      // Toggle quote mode
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  // Push last field
  result.push(current.trim())

  return result
}

/**
 * Generate a sample CSV template
 */
export function generateCSVTemplate(): string {
  return `email,role,storeId
john.doe@example.com,Staff,
jane.smith@example.com,Manager,
driver@example.com,Driver,`
}
