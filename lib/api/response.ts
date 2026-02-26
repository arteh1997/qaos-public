import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { RateLimitResult, getRateLimitHeaders } from '@/lib/rate-limit'

/**
 * Standardized API Response Utilities
 * Provides consistent response format across all API endpoints
 */

/**
 * Sanitizes error messages for client responses
 * Removes sensitive information like file paths, stack traces, and credentials
 */
function sanitizeApiErrorMessage(message: string): string {
  // Patterns that indicate sensitive information
  const sensitivePatterns = [
    /at\s+[\w.]+\s+\([^)]+\)/gi,  // Stack trace lines
    /\/[\w/.-]+\.(ts|js|tsx|jsx)/gi,  // File paths
    /line\s+\d+/gi,  // Line numbers
    /column\s+\d+/gi,  // Column numbers
    /ECONNREFUSED|ETIMEDOUT|ENOTFOUND/gi,  // Network error codes
    /password|secret|api[_-]?key|token|credential/gi,  // Sensitive keywords
    /postgresql?:\/\/[^\s]+/gi,  // Database connection strings
    /Bearer\s+[\w.-]+/gi,  // Auth tokens
    /node_modules/gi,  // Node modules paths
    /supabase[^\s]*/gi,  // Supabase-specific info
  ]

  let sanitized = message

  // Remove sensitive patterns
  for (const pattern of sensitivePatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]')
  }

  // If the message is too technical or became mostly redacted, return generic message
  if (
    sanitized.includes('[REDACTED]') ||
    sanitized.length > 200 ||
    sanitized.includes('undefined') ||
    sanitized.includes('null')
  ) {
    // Try to extract a user-friendly portion
    const userFriendlyPrefixes = [
      'Invalid',
      'Missing',
      'Required',
      'Cannot',
      'Unable',
      'Failed',
      'Not found',
      'Already exists',
      'Duplicate',
      'Permission denied',
    ]

    for (const prefix of userFriendlyPrefixes) {
      if (message.toLowerCase().includes(prefix.toLowerCase())) {
        // Find and return the relevant portion
        const idx = message.toLowerCase().indexOf(prefix.toLowerCase())
        const portion = message.substring(idx).split(/[.!?\n]/)[0]
        if (portion.length <= 100 && !portion.includes('[REDACTED]')) {
          return portion.charAt(0).toUpperCase() + portion.slice(1)
        }
      }
    }

    return 'An error occurred while processing your request'
  }

  return sanitized.slice(0, 200)
}

/**
 * Sanitizes search input for database queries (server-side)
 * Removes special characters that could affect PostgREST queries
 */
export function sanitizeSearchQuery(input: string | null | undefined): string {
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

// Generate unique request ID for tracing
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`
}

// Standard pagination metadata
export interface PaginationMeta {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// Standard API response structure
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  pagination?: PaginationMeta
  requestId: string
}

// Standard error response structure
export interface ApiErrorResponse {
  success: false
  message: string
  code?: string
  requestId: string
}

/**
 * Create pagination metadata from query results
 */
export function createPaginationMeta(
  page: number,
  pageSize: number,
  totalItems: number
): PaginationMeta {
  const totalPages = Math.ceil(totalItems / pageSize)
  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}

/**
 * Create standard headers including request ID
 */
function createHeaders(
  requestId: string,
  rateLimitResult?: RateLimitResult
): HeadersInit {
  const headers: Record<string, string> = {
    'X-Request-ID': requestId,
  }

  if (rateLimitResult) {
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult)
    Object.assign(headers, rateLimitHeaders)
  }

  return headers
}

/**
 * Success response helper
 */
export function apiSuccess<T>(
  data: T,
  options: {
    requestId?: string
    pagination?: PaginationMeta
    rateLimitResult?: RateLimitResult
    status?: number
    cacheControl?: string
  } = {}
): NextResponse<ApiResponse<T>> {
  const requestId = options.requestId ?? generateRequestId()

  const response: ApiResponse<T> = {
    success: true,
    data,
    requestId,
  }

  if (options.pagination) {
    response.pagination = options.pagination
  }

  const headers = createHeaders(requestId, options.rateLimitResult) as Record<string, string>
  if (options.cacheControl) {
    headers['Cache-Control'] = options.cacheControl
  }

  return NextResponse.json(response, {
    status: options.status ?? 200,
    headers,
  })
}

/**
 * Error response helper
 * Automatically sanitizes error messages to prevent information disclosure
 */
export function apiError(
  message: string,
  options: {
    requestId?: string
    status?: number
    code?: string
    rateLimitResult?: RateLimitResult
    skipSanitization?: boolean  // For pre-sanitized or intentionally specific messages
  } = {}
): NextResponse<ApiErrorResponse> {
  const requestId = options.requestId ?? generateRequestId()

  // Report server errors (5xx) to Sentry for monitoring
  const status = options.status ?? 500
  if (status >= 500) {
    Sentry.captureMessage(message, {
      level: 'error',
      extra: { requestId, code: options.code, status },
    })
  }

  // Sanitize the message unless explicitly skipped
  const sanitizedMessage = options.skipSanitization
    ? message
    : sanitizeApiErrorMessage(message)

  const response: ApiErrorResponse = {
    success: false,
    message: sanitizedMessage,
    requestId,
  }

  if (options.code) {
    response.code = options.code
  }

  return NextResponse.json(response, {
    status: options.status ?? 500,
    headers: createHeaders(requestId, options.rateLimitResult),
  })
}

/**
 * Unauthorized response (401)
 */
export function apiUnauthorized(requestId?: string): NextResponse<ApiErrorResponse> {
  return apiError('Unauthorized', {
    requestId,
    status: 401,
    code: 'UNAUTHORIZED',
  })
}

/**
 * Forbidden response (403)
 */
export function apiForbidden(
  message = 'You do not have permission to perform this action',
  requestId?: string
): NextResponse<ApiErrorResponse> {
  return apiError(message, {
    requestId,
    status: 403,
    code: 'FORBIDDEN',
  })
}

/**
 * Not found response (404)
 */
export function apiNotFound(
  resource = 'Resource',
  requestId?: string
): NextResponse<ApiErrorResponse> {
  return apiError(`${resource} not found`, {
    requestId,
    status: 404,
    code: 'NOT_FOUND',
  })
}

/**
 * Bad request response (400)
 */
export function apiBadRequest(
  message: string,
  requestId?: string
): NextResponse<ApiErrorResponse> {
  return apiError(message, {
    requestId,
    status: 400,
    code: 'BAD_REQUEST',
  })
}

/**
 * Rate limit exceeded response (429)
 */
export function apiRateLimited(
  rateLimitResult: RateLimitResult,
  requestId?: string
): NextResponse<ApiErrorResponse> {
  return apiError('Too many requests. Please try again later.', {
    requestId,
    status: 429,
    code: 'RATE_LIMITED',
    rateLimitResult,
  })
}

/**
 * Validation error response (400)
 */
export function apiValidationError(
  errors: Record<string, string[]> | string,
  requestId?: string
): NextResponse<ApiErrorResponse> {
  const message = typeof errors === 'string'
    ? errors
    : Object.entries(errors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ')

  return apiError(message, {
    requestId,
    status: 400,
    code: 'VALIDATION_ERROR',
    skipSanitization: true,  // Validation messages are already formatted and safe
  })
}
