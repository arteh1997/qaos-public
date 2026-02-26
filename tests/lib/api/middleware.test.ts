import { describe, it, expect } from 'vitest'
import {
  canAccessStore,
  canManageStore,
  canManageUsersAtStore,
  getUserRoleAtStore,
  parsePaginationParams,
  parseFilterParams,
  AuthContext,
} from '@/lib/api/middleware'
import { NextRequest } from 'next/server'
import { AppRole, StoreUserWithStore } from '@/types'

// Helper to create a mock StoreUserWithStore
function createStoreMembership(
  storeId: string,
  role: AppRole,
  isBillingOwner = false
): StoreUserWithStore {
  return {
    id: `membership-${storeId}`,
    store_id: storeId,
    user_id: 'user-123',
    role,
    is_billing_owner: isBillingOwner,
    invited_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    store: {
      id: storeId,
      name: `Store ${storeId}`,
      address: '123 Test St',
      is_active: true,
      billing_user_id: null,
      subscription_status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }
}

// Helper to create a mock AuthContext
function createAuthContext(options: {
  stores?: StoreUserWithStore[]
  isPlatformAdmin?: boolean
  role?: AppRole | null
  storeId?: string | null
}): AuthContext {
  return {
    user: { id: 'user-123', email: 'test@example.com' },
    profile: {
      role: options.role ?? null,
      store_id: options.storeId ?? null,
      is_platform_admin: options.isPlatformAdmin ?? false,
    },
    stores: options.stores ?? [],
    requestId: 'test-request-id',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: {} as any,
  }
}

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

    describe('Owner Role', () => {
      it('should allow access to their store', () => {
        const context = createAuthContext({
          stores: [createStoreMembership(targetStoreId, 'Owner')],
        })
        expect(canAccessStore(context, targetStoreId)).toBe(true)
      })

      it('should deny access to stores without membership', () => {
        const context = createAuthContext({
          stores: [createStoreMembership(userStoreId, 'Owner')],
        })
        expect(canAccessStore(context, targetStoreId)).toBe(false)
      })
    })

    describe('Manager Role', () => {
      it('should allow access to their store', () => {
        const context = createAuthContext({
          stores: [createStoreMembership(targetStoreId, 'Manager')],
        })
        expect(canAccessStore(context, targetStoreId)).toBe(true)
      })

      it('should deny access to different store', () => {
        const context = createAuthContext({
          stores: [createStoreMembership(userStoreId, 'Manager')],
        })
        expect(canAccessStore(context, targetStoreId)).toBe(false)
      })
    })

    describe('Staff Role (multi-membership)', () => {
      it('should allow access when member of multiple stores', () => {
        const context = createAuthContext({
          stores: [
            createStoreMembership(targetStoreId, 'Staff'),
            createStoreMembership(userStoreId, 'Staff'),
          ],
        })
        expect(canAccessStore(context, targetStoreId)).toBe(true)
        expect(canAccessStore(context, userStoreId)).toBe(true)
      })
    })

    describe('Staff Role', () => {
      it('should allow access to assigned store', () => {
        const context = createAuthContext({
          stores: [createStoreMembership(targetStoreId, 'Staff')],
        })
        expect(canAccessStore(context, targetStoreId)).toBe(true)
      })

      it('should deny access to different store', () => {
        const context = createAuthContext({
          stores: [createStoreMembership(userStoreId, 'Staff')],
        })
        expect(canAccessStore(context, targetStoreId)).toBe(false)
      })

      it('should deny access when no store assigned', () => {
        const context = createAuthContext({
          stores: [],
        })
        expect(canAccessStore(context, targetStoreId)).toBe(false)
      })
    })

    describe('Platform Admin', () => {
      it('should allow access to any store', () => {
        const context = createAuthContext({
          isPlatformAdmin: true,
          stores: [],
        })
        expect(canAccessStore(context, targetStoreId)).toBe(true)
      })

      it('should allow access even without store membership', () => {
        const context = createAuthContext({
          isPlatformAdmin: true,
          stores: [createStoreMembership(userStoreId, 'Staff')],
        })
        expect(canAccessStore(context, targetStoreId)).toBe(true)
      })
    })
  })

  describe('canManageStore', () => {
    const targetStoreId = 'store-123'

    it('should return true for Owner', () => {
      const context = createAuthContext({
        stores: [createStoreMembership(targetStoreId, 'Owner')],
      })
      expect(canManageStore(context, targetStoreId)).toBe(true)
    })

    it('should return true for Manager', () => {
      const context = createAuthContext({
        stores: [createStoreMembership(targetStoreId, 'Manager')],
      })
      expect(canManageStore(context, targetStoreId)).toBe(true)
    })

    it('should return false for Staff', () => {
      const context = createAuthContext({
        stores: [createStoreMembership(targetStoreId, 'Staff')],
      })
      expect(canManageStore(context, targetStoreId)).toBe(false)
    })

    it('should return true for platform admin', () => {
      const context = createAuthContext({
        isPlatformAdmin: true,
        stores: [],
      })
      expect(canManageStore(context, targetStoreId)).toBe(true)
    })
  })

  describe('canManageUsersAtStore', () => {
    const targetStoreId = 'store-123'

    it('should return true for Owner', () => {
      const context = createAuthContext({
        stores: [createStoreMembership(targetStoreId, 'Owner')],
      })
      expect(canManageUsersAtStore(context, targetStoreId)).toBe(true)
    })

    it('should return false for Manager', () => {
      const context = createAuthContext({
        stores: [createStoreMembership(targetStoreId, 'Manager')],
      })
      expect(canManageUsersAtStore(context, targetStoreId)).toBe(false)
    })

    it('should return false for Staff', () => {
      const context = createAuthContext({
        stores: [createStoreMembership(targetStoreId, 'Staff')],
      })
      expect(canManageUsersAtStore(context, targetStoreId)).toBe(false)
    })

    it('should return true for platform admin', () => {
      const context = createAuthContext({
        isPlatformAdmin: true,
        stores: [],
      })
      expect(canManageUsersAtStore(context, targetStoreId)).toBe(true)
    })
  })

  describe('getUserRoleAtStore', () => {
    const targetStoreId = 'store-123'

    it('should return the role at the store', () => {
      const context = createAuthContext({
        stores: [createStoreMembership(targetStoreId, 'Manager')],
      })
      expect(getUserRoleAtStore(context, targetStoreId)).toBe('Manager')
    })

    it('should return null if no membership at store', () => {
      const context = createAuthContext({
        stores: [createStoreMembership('other-store', 'Owner')],
      })
      expect(getUserRoleAtStore(context, targetStoreId)).toBe(null)
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
