import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateRequestId,
  createPaginationMeta,
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiBadRequest,
  apiRateLimited,
  apiValidationError,
} from '@/lib/api/response'

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, init) => ({
      data,
      status: init?.status ?? 200,
      headers: init?.headers ?? {},
    })),
  },
}))

describe('API Response Utilities', () => {
  describe('generateRequestId', () => {
    it('should generate a string starting with "req_"', () => {
      const id = generateRequestId()
      expect(id.startsWith('req_')).toBe(true)
    })

    it('should generate unique IDs', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(generateRequestId())
      }
      expect(ids.size).toBe(100)
    })

    it('should generate IDs of reasonable length', () => {
      const id = generateRequestId()
      expect(id.length).toBeGreaterThan(10)
      expect(id.length).toBeLessThan(30)
    })
  })

  describe('createPaginationMeta', () => {
    it('should calculate correct pagination for first page', () => {
      const meta = createPaginationMeta(1, 20, 100)

      expect(meta).toEqual({
        page: 1,
        pageSize: 20,
        totalItems: 100,
        totalPages: 5,
        hasNext: true,
        hasPrev: false,
      })
    })

    it('should calculate correct pagination for middle page', () => {
      const meta = createPaginationMeta(3, 20, 100)

      expect(meta).toEqual({
        page: 3,
        pageSize: 20,
        totalItems: 100,
        totalPages: 5,
        hasNext: true,
        hasPrev: true,
      })
    })

    it('should calculate correct pagination for last page', () => {
      const meta = createPaginationMeta(5, 20, 100)

      expect(meta).toEqual({
        page: 5,
        pageSize: 20,
        totalItems: 100,
        totalPages: 5,
        hasNext: false,
        hasPrev: true,
      })
    })

    it('should handle single page of results', () => {
      const meta = createPaginationMeta(1, 20, 15)

      expect(meta).toEqual({
        page: 1,
        pageSize: 20,
        totalItems: 15,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      })
    })

    it('should handle empty results', () => {
      const meta = createPaginationMeta(1, 20, 0)

      expect(meta).toEqual({
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      })
    })

    it('should handle exact page boundary', () => {
      const meta = createPaginationMeta(1, 10, 10)

      expect(meta.totalPages).toBe(1)
      expect(meta.hasNext).toBe(false)
    })

    it('should round up total pages for partial last page', () => {
      const meta = createPaginationMeta(1, 20, 21)

      expect(meta.totalPages).toBe(2)
      expect(meta.hasNext).toBe(true)
    })
  })

  describe('apiSuccess', () => {
    it('should return success response with data', () => {
      const data = { id: 1, name: 'Test' }
      const response = apiSuccess(data)

      expect(response.data.success).toBe(true)
      expect(response.data.data).toEqual(data)
      expect(response.status).toBe(200)
    })

    it('should include custom request ID when provided', () => {
      const response = apiSuccess({ test: true }, { requestId: 'custom-123' })

      expect(response.data.requestId).toBe('custom-123')
    })

    it('should include pagination when provided', () => {
      const pagination = createPaginationMeta(1, 20, 100)
      const response = apiSuccess([], { pagination })

      expect(response.data.pagination).toEqual(pagination)
    })

    it('should allow custom status codes', () => {
      const response = apiSuccess({ created: true }, { status: 201 })

      expect(response.status).toBe(201)
    })

    it('should handle null data', () => {
      const response = apiSuccess(null)

      expect(response.data.success).toBe(true)
      expect(response.data.data).toBeNull()
    })

    it('should handle array data', () => {
      const data = [{ id: 1 }, { id: 2 }]
      const response = apiSuccess(data)

      expect(response.data.data).toEqual(data)
    })
  })

  describe('apiError', () => {
    it('should return error response with message', () => {
      const response = apiError('Something went wrong')

      expect(response.data.success).toBe(false)
      expect(response.data.message).toBe('Something went wrong')
      expect(response.status).toBe(500)
    })

    it('should allow custom status codes', () => {
      const response = apiError('Bad data', { status: 400 })

      expect(response.status).toBe(400)
    })

    it('should include error code when provided', () => {
      const response = apiError('Access denied', { code: 'ACCESS_DENIED' })

      expect(response.data.code).toBe('ACCESS_DENIED')
    })

    it('should include request ID when provided', () => {
      const response = apiError('Error', { requestId: 'req-error-123' })

      expect(response.data.requestId).toBe('req-error-123')
    })
  })

  describe('apiUnauthorized', () => {
    it('should return 401 status', () => {
      const response = apiUnauthorized()

      expect(response.status).toBe(401)
      expect(response.data.success).toBe(false)
      expect(response.data.message).toBe('Unauthorized')
      expect(response.data.code).toBe('UNAUTHORIZED')
    })

    it('should include request ID when provided', () => {
      const response = apiUnauthorized('req-unauth-123')

      expect(response.data.requestId).toBe('req-unauth-123')
    })
  })

  describe('apiForbidden', () => {
    it('should return 403 status with default message', () => {
      const response = apiForbidden()

      expect(response.status).toBe(403)
      expect(response.data.success).toBe(false)
      expect(response.data.message).toBe(
        'You do not have permission to perform this action'
      )
      expect(response.data.code).toBe('FORBIDDEN')
    })

    it('should allow custom message', () => {
      const response = apiForbidden('Cannot access this store')

      expect(response.data.message).toBe('Cannot access this store')
    })

    it('should include request ID when provided', () => {
      const response = apiForbidden(undefined, 'req-403')

      expect(response.data.requestId).toBe('req-403')
    })
  })

  describe('apiNotFound', () => {
    it('should return 404 status with default message', () => {
      const response = apiNotFound()

      expect(response.status).toBe(404)
      expect(response.data.success).toBe(false)
      expect(response.data.message).toBe('Resource not found')
      expect(response.data.code).toBe('NOT_FOUND')
    })

    it('should allow custom resource name', () => {
      const response = apiNotFound('Store')

      expect(response.data.message).toBe('Store not found')
    })

    it('should include request ID when provided', () => {
      const response = apiNotFound('User', 'req-404')

      expect(response.data.requestId).toBe('req-404')
    })
  })

  describe('apiBadRequest', () => {
    it('should return 400 status', () => {
      const response = apiBadRequest('Invalid input')

      expect(response.status).toBe(400)
      expect(response.data.success).toBe(false)
      expect(response.data.message).toBe('Invalid input')
      expect(response.data.code).toBe('BAD_REQUEST')
    })

    it('should include request ID when provided', () => {
      const response = apiBadRequest('Missing field', 'req-400')

      expect(response.data.requestId).toBe('req-400')
    })
  })

  describe('apiRateLimited', () => {
    it('should return 429 status', () => {
      const rateLimitResult = {
        success: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        limit: 100,
      }
      const response = apiRateLimited(rateLimitResult)

      expect(response.status).toBe(429)
      expect(response.data.success).toBe(false)
      expect(response.data.message).toBe(
        'Too many requests. Please try again later.'
      )
      expect(response.data.code).toBe('RATE_LIMITED')
    })

    it('should include request ID when provided', () => {
      const rateLimitResult = {
        success: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        limit: 100,
      }
      const response = apiRateLimited(rateLimitResult, 'req-429')

      expect(response.data.requestId).toBe('req-429')
    })
  })

  describe('apiValidationError', () => {
    it('should return 400 status with string error', () => {
      const response = apiValidationError('Email is required')

      expect(response.status).toBe(400)
      expect(response.data.success).toBe(false)
      expect(response.data.message).toBe('Email is required')
      expect(response.data.code).toBe('VALIDATION_ERROR')
    })

    it('should format field errors as string', () => {
      const errors = {
        email: ['Email is required', 'Email must be valid'],
        password: ['Password too short'],
      }
      const response = apiValidationError(errors)

      expect(response.data.message).toBe(
        'email: Email is required, Email must be valid; password: Password too short'
      )
    })

    it('should handle single field error', () => {
      const errors = { name: ['Name is required'] }
      const response = apiValidationError(errors)

      expect(response.data.message).toBe('name: Name is required')
    })

    it('should include request ID when provided', () => {
      const response = apiValidationError('Invalid', 'req-val')

      expect(response.data.requestId).toBe('req-val')
    })
  })

  describe('Request ID Header Behavior', () => {
    it('should include X-Request-ID header in success response', () => {
      const response = apiSuccess({ test: true }, { requestId: 'test-123' })

      expect(response.headers['X-Request-ID']).toBe('test-123')
    })

    it('should include X-Request-ID header in error response', () => {
      const response = apiError('Error', { requestId: 'error-123' })

      expect(response.headers['X-Request-ID']).toBe('error-123')
    })
  })
})
