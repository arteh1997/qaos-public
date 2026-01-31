import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Sanitizes a string to prevent XSS attacks
 * Escapes HTML special characters
 */
export function sanitizeString(input: string | null | undefined): string {
  if (!input) return ''

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Sanitizes notes field - trims whitespace and escapes HTML
 * Use this when saving notes to the database
 */
export function sanitizeNotes(notes: string | null | undefined): string | undefined {
  if (!notes) return undefined

  const trimmed = notes.trim()
  if (!trimmed) return undefined

  // Remove any HTML tags
  const stripped = trimmed.replace(/<[^>]*>/g, '')

  // Limit length to prevent abuse
  return stripped.slice(0, 1000)
}

/**
 * Sanitizes search input for database queries
 * Removes special characters that could affect PostgREST queries
 * and limits length to prevent abuse
 */
export function sanitizeSearchInput(input: string | null | undefined): string {
  if (!input) return ''

  return input
    // Remove PostgREST special characters that could affect query parsing
    .replace(/[(),.:]/g, ' ')
    // Remove potential SQL/injection characters
    .replace(/[;'"\\]/g, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    // Trim and limit length
    .trim()
    .slice(0, 100)
}

/**
 * Sanitizes error messages before sending to client
 * Removes sensitive information like stack traces, file paths, and internal details
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (!error) return 'An unexpected error occurred'

  const message = error instanceof Error ? error.message : String(error)

  // List of patterns that indicate sensitive information
  const sensitivePatterns = [
    /at\s+[\w.]+\s+\([^)]+\)/gi,  // Stack trace lines
    /\/[\w/.-]+\.(ts|js|tsx|jsx)/gi,  // File paths
    /line\s+\d+/gi,  // Line numbers
    /column\s+\d+/gi,  // Column numbers
    /ECONNREFUSED|ETIMEDOUT|ENOTFOUND/gi,  // Network error codes
    /password|secret|key|token|credential/gi,  // Sensitive keywords
    /postgresql?:\/\/[^\s]+/gi,  // Database connection strings
    /Bearer\s+[\w.-]+/gi,  // Auth tokens
  ]

  let sanitized = message

  // Remove sensitive patterns
  for (const pattern of sensitivePatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]')
  }

  // If the message becomes mostly redacted or is too technical, return generic message
  if (sanitized.includes('[REDACTED]') || sanitized.length > 200) {
    // Try to extract a user-friendly portion
    const userFriendlyPrefixes = [
      'Invalid',
      'Missing',
      'Required',
      'Cannot',
      'Unable',
      'Failed to',
      'Not found',
      'Already exists',
      'Unauthorized',
      'Forbidden',
    ]

    for (const prefix of userFriendlyPrefixes) {
      if (message.toLowerCase().startsWith(prefix.toLowerCase())) {
        // Return first sentence only
        const firstSentence = message.split(/[.!?]/)[0]
        if (firstSentence.length <= 100) {
          return firstSentence
        }
      }
    }

    return 'An error occurred while processing your request'
  }

  return sanitized.slice(0, 200)
}
