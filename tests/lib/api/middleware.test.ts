import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  canAccessStore,
  parsePaginationParams,
  parseFilterParams,
} from '@/lib/api/middleware'
import { NextRequest } from 'next/server'

// Mock NextRequest for parameter parsing tests
function createMockRequest(searchParams: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/test')
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  return {
    nextUrl: url,
  } as unknown as NextRequest
}

describe('API Middleware Helpers', () => {
  describe('canAccessStore', () => {
    const targetStoreId = 'store-target-123'
    const userStoreId = 'store-user-456'

    describe('Admin Role', () => {
      it('should allow access to any store', () => {
        expect(
          canAccessStore(
            { role: 'Admin', store_id: null },
            targetStoreId
          )
        ).toBe(true)
      })

      it('should allow access even with different store_id', () => {
        expect(
          canAccessStore(
            { role: 'Admin', store_id: userStoreId },
            targetStoreId
          )
        ).toBe(true)
      })
    })

    describe('Driver Role', () => {
      it('should allow access to any store', () => {
        expect(
          canAccessStore(
            { role: 'Driver', store_id: null },
            targetStoreId
          )
        ).toBe(true)
      })

      it('should allow access even with different store_id', () => {
        expect(
          canAccessStore(
            { role: 'Driver', store_id: userStoreId },
            targetStoreId
          )
        ).toBe(true)
      })
    })

    describe('Staff Role', () => {
      it('should allow access to assigned store', () => {
        expect(
          canAccessStore(
            { role: 'Staff', store_id: targetStoreId },
            targetStoreId
          )
        ).toBe(true)
      })

      it('should deny access to different store', () => {
        expect(
          canAccessStore(
            { role: 'Staff', store_id: userStoreId },
            targetStoreId
          )
        ).toBe(false)
      })

      it('should deny access when no store assigned', () => {
        expect(
          canAccessStore(
            { role: 'Staff', store_id: null },
            targetStoreId
          )
        ).toBe(false)
      })
    })
  })

  describe('parsePaginationParams', () => {
    describe('Default Values', () => {
      it('should return default values when no params provided', () => {
        const request = createMockRequest({})
        const result = parsePaginationParams(request)

        expect(result.page).toBe(1)
        expect(result.pageSize).toBe(20)
        expect(result.from).toBe(0)
        expect(result.to).toBe(19)
      })

      it('should use provided defaults', () => {
        const request = createMockRequest({})
        const result = parsePaginationParams(request, { page: 2, pageSize: 10 })

        expect(result.page).toBe(2)
        expect(result.pageSize).toBe(10)
        expect(result.from).toBe(10)
        expect(result.to).toBe(19)
      })
    })

    describe('Valid Parameters', () => {
      it('should parse page and pageSize from query params', () => {
        const request = createMockRequest({ page: '3', pageSize: '50' })
        const result = parsePaginationParams(request)

        expect(result.page).toBe(3)
        expect(result.pageSize).toBe(50)
        expect(result.from).toBe(100)
        expect(result.to).toBe(149)
      })

      it('should calculate correct range for first page', () => {
        const request = createMockRequest({ page: '1', pageSize: '25' })
        const result = parsePaginationParams(request)

        expect(result.from).toBe(0)
        expect(result.to).toBe(24)
      })

      it('should calculate correct range for subsequent pages', () => {
        const request = createMockRequest({ page: '5', pageSize: '10' })
        const result = parsePaginationParams(request)

        expect(result.from).toBe(40)
        expect(result.to).toBe(49)
      })
    })

    describe('Boundary Validation', () => {
      it('should enforce minimum page of 1', () => {
        const request = createMockRequest({ page: '0' })
        const result = parsePaginationParams(request)

        expect(result.page).toBe(1)
      })

      it('should enforce minimum page of 1 for negative values', () => {
        const request = createMockRequest({ page: '-5' })
        const result = parsePaginationParams(request)

        expect(result.page).toBe(1)
      })

      it('should enforce maximum pageSize of 100', () => {
        const request = createMockRequest({ pageSize: '500' })
        const result = parsePaginationParams(request)

        expect(result.pageSize).toBe(100)
      })

      it('should enforce minimum pageSize of 1', () => {
        const request = createMockRequest({ pageSize: '0' })
        const result = parsePaginationParams(request)

        expect(result.pageSize).toBe(1)
      })

      it('should enforce minimum pageSize of 1 for negative values', () => {
        const request = createMockRequest({ pageSize: '-10' })
        const result = parsePaginationParams(request)

        expect(result.pageSize).toBe(1)
      })
    })

    describe('Edge Cases', () => {
      it('should handle non-numeric page value as NaN', () => {
        const request = createMockRequest({ page: 'abc' })
        const result = parsePaginationParams(request)

        // parseInt('abc') returns NaN, Math.max(1, NaN) returns NaN
        // This is a known edge case - the middleware doesn't handle NaN
        expect(result.page).toBeNaN()
      })

      it('should handle non-numeric pageSize value as NaN', () => {
        const request = createMockRequest({ pageSize: 'large' })
        const result = parsePaginationParams(request)

        // Math.min/max with NaN returns NaN
        expect(result.pageSize).toBeNaN()
      })

      it('should handle decimal page values', () => {
        const request = createMockRequest({ page: '2.7' })
        const result = parsePaginationParams(request)

        expect(result.page).toBe(2) // parseInt truncates decimals
      })
    })
  })

  describe('parseFilterParams', () => {
    it('should extract all filter params when present', () => {
      const request = createMockRequest({
        search: 'test query',
        store_id: 'store-123',
        status: 'active',
        date: '2024-01-15',
      })
      const result = parseFilterParams(request)

      expect(result.search).toBe('test query')
      expect(result.storeId).toBe('store-123')
      expect(result.status).toBe('active')
      expect(result.date).toBe('2024-01-15')
    })

    it('should return null for missing params', () => {
      const request = createMockRequest({})
      const result = parseFilterParams(request)

      expect(result.search).toBeNull()
      expect(result.storeId).toBeNull()
      expect(result.status).toBeNull()
      expect(result.date).toBeNull()
    })

    it('should handle partial filter params', () => {
      const request = createMockRequest({
        search: 'query',
        status: 'inactive',
      })
      const result = parseFilterParams(request)

      expect(result.search).toBe('query')
      expect(result.storeId).toBeNull()
      expect(result.status).toBe('inactive')
      expect(result.date).toBeNull()
    })

    it('should handle empty string values', () => {
      const request = createMockRequest({
        search: '',
        status: '',
      })
      const result = parseFilterParams(request)

      // URLSearchParams treats empty strings as valid values
      expect(result.search).toBe('')
      expect(result.status).toBe('')
    })

    it('should handle special characters in search', () => {
      const request = createMockRequest({
        search: "Tom's Place & Grill",
      })
      const result = parseFilterParams(request)

      expect(result.search).toBe("Tom's Place & Grill")
    })

    it('should handle URL-encoded values', () => {
      // Note: When using url.searchParams.set(), the value is stored as-is
      // URL encoding/decoding happens during URL parsing, not when using set()
      const request = createMockRequest({
        search: 'hello%20world',
      })
      const result = parseFilterParams(request)

      // The mock sets the value directly, so %20 is preserved as literal string
      expect(result.search).toBe('hello%20world')
    })
  })
})
