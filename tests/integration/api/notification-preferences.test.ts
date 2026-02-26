import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Create chainable query builder mock
function createChainableMock(resolvedValue: unknown = { data: null, error: null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: Record<string, ReturnType<typeof vi.fn>> & { then?: any } = {}
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike',
    'in', 'is', 'or', 'and', 'not', 'filter', 'match',
    'order', 'limit', 'range', 'single', 'maybeSingle',
  ]

  methods.forEach(method => {
    if (method === 'single' || method === 'maybeSingle') {
      mock[method] = vi.fn().mockResolvedValue(resolvedValue)
    } else if (method === 'range') {
      mock[method] = vi.fn().mockResolvedValue(resolvedValue)
    } else {
      mock[method] = vi.fn(() => mock)
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mock.then = ((resolve?: any) => Promise.resolve(resolvedValue).then(resolve)) as any
  return mock
}

function createMockRequest(method: string, searchParams?: Record<string, string>, body?: unknown): NextRequest {
  const url = new URL('http://localhost:3000/api/stores/store-1/notification-preferences')
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  return {
    method,
    nextUrl: url,
    url: url.toString(),
    json: vi.fn(() => Promise.resolve(body ?? {})),
    clone: vi.fn(function(this: { json: ReturnType<typeof vi.fn> }) { return { json: this.json } }),
    headers: new Headers({ 'content-type': 'application/json' }),
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as NextRequest
}

// Mock Supabase client
const mockSupabaseClient = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({
    success: true,
    remaining: 99,
    resetTime: Date.now() + 60000,
    limit: 100,
  })),
  RATE_LIMITS: {
    api: { limit: 100, windowMs: 60000 },
  },
  getRateLimitHeaders: vi.fn(() => ({})),
}))

vi.mock('@/lib/csrf', () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
}))

// Mock admin client — PUT handler uses createAdminClient for upsert
const mockAdminClient = {
  from: vi.fn(),
}
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}))

const mockStoreId = 'store-1'
const mockUserId = 'user-123'

function setupAuthMocks(role: string = 'Owner') {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: mockUserId, email: 'owner@test.com' } },
    error: null,
  })

  const profileQuery = createChainableMock({
    data: {
      id: mockUserId,
      role,
      store_id: null,
      is_platform_admin: false,
      default_store_id: null,
    },
    error: null,
  })

  const storeUsersQuery = createChainableMock({
    data: [{ id: 'su-1', store_id: mockStoreId, user_id: mockUserId, role, store: { id: mockStoreId, name: 'Test Store', is_active: true } }],
    error: null,
  })

  return { profileQuery, storeUsersQuery }
}

describe('Notification Preferences API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/stores/[storeId]/notification-preferences', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      })

      const { GET } = await import('@/app/api/stores/[storeId]/notification-preferences/route')
      const request = createMockRequest('GET')
      const response = await GET(request, { params: Promise.resolve({ storeId: mockStoreId }) })
      expect(response.status).toBe(401)
    })

    it('should return 403 for unauthorized store', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks('Owner')

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return createChainableMock({ data: null, error: null })
      })

      const { GET } = await import('@/app/api/stores/[storeId]/notification-preferences/route')
      const request = createMockRequest('GET')
      const response = await GET(request, { params: Promise.resolve({ storeId: 'other-store-999' }) })
      expect(response.status).toBe(403)
    })

    it('should return existing preferences', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks('Owner')

      const savedPrefs = {
        id: 'notif-pref-1',
        store_id: mockStoreId,
        user_id: mockUserId,
        shift_assigned: false,
        shift_updated: true,
        shift_cancelled: true,
        payslip_available: true,
        po_supplier_update: false,
        delivery_received: true,
        removed_from_store: true,
      }
      const prefsQuery = createChainableMock({ data: savedPrefs, error: null })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'notification_preferences') return prefsQuery
        return createChainableMock({ data: null, error: null })
      })

      const { GET } = await import('@/app/api/stores/[storeId]/notification-preferences/route')
      const request = createMockRequest('GET')
      const response = await GET(request, { params: Promise.resolve({ storeId: mockStoreId }) })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.shift_assigned).toBe(false)
      expect(body.data.shift_updated).toBe(true)
      expect(body.data.po_supplier_update).toBe(false)
      expect(body.data.delivery_received).toBe(true)
      expect(body.data.is_default).toBeUndefined()
    })

    it('should create and return defaults when none exist', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks('Owner')
      const prefsQuery = createChainableMock({ data: null, error: null })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'notification_preferences') return prefsQuery
        return createChainableMock({ data: null, error: null })
      })

      const { GET } = await import('@/app/api/stores/[storeId]/notification-preferences/route')
      const request = createMockRequest('GET')
      const response = await GET(request, { params: Promise.resolve({ storeId: mockStoreId }) })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.store_id).toBe(mockStoreId)
      expect(body.data.user_id).toBe(mockUserId)
      expect(body.data.shift_assigned).toBe(true)
      expect(body.data.shift_updated).toBe(true)
      expect(body.data.shift_cancelled).toBe(true)
      expect(body.data.payslip_available).toBe(true)
      expect(body.data.po_supplier_update).toBe(true)
      expect(body.data.delivery_received).toBe(true)
      expect(body.data.removed_from_store).toBe(true)
      expect(body.data.is_default).toBe(true)
    })
  })

  describe('PUT /api/stores/[storeId]/notification-preferences', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      })

      const { PUT } = await import('@/app/api/stores/[storeId]/notification-preferences/route')
      const request = createMockRequest('PUT', undefined, { shift_assigned: false })
      const response = await PUT(request, { params: Promise.resolve({ storeId: mockStoreId }) })
      expect(response.status).toBe(401)
    })

    it('should return 400 with invalid body', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks('Owner')

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return createChainableMock({ data: null, error: null })
      })

      const { PUT } = await import('@/app/api/stores/[storeId]/notification-preferences/route')
      const request = createMockRequest('PUT', undefined, { shift_assigned: 'not-a-boolean' })
      const response = await PUT(request, { params: Promise.resolve({ storeId: mockStoreId }) })

      expect(response.status).toBe(400)
    })

    it('should update preferences successfully', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks('Owner')

      const updatedPrefs = {
        id: 'notif-pref-1',
        store_id: mockStoreId,
        user_id: mockUserId,
        shift_assigned: false,
        shift_updated: false,
        shift_cancelled: true,
        payslip_available: true,
        po_supplier_update: true,
        delivery_received: true,
        removed_from_store: true,
      }
      const prefsQuery = createChainableMock({ data: updatedPrefs, error: null })

      // Auth middleware uses mockSupabaseClient
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return createChainableMock({ data: null, error: null })
      })

      // PUT handler uses admin client for the upsert
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'notification_preferences') return prefsQuery
        return createChainableMock({ data: null, error: null })
      })

      const { PUT } = await import('@/app/api/stores/[storeId]/notification-preferences/route')
      const request = createMockRequest('PUT', undefined, { shift_assigned: false, shift_updated: false })
      const response = await PUT(request, { params: Promise.resolve({ storeId: mockStoreId }) })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.shift_assigned).toBe(false)
      expect(body.data.shift_updated).toBe(false)
      expect(body.data.store_id).toBe(mockStoreId)
      expect(body.data.user_id).toBe(mockUserId)
    })

    it('should only update provided fields (partial update)', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks('Owner')

      // Only payslip_available is being updated; everything else remains at existing values
      const partialUpdateResult = {
        id: 'notif-pref-1',
        store_id: mockStoreId,
        user_id: mockUserId,
        shift_assigned: true,
        shift_updated: true,
        shift_cancelled: true,
        payslip_available: false,
        po_supplier_update: true,
        delivery_received: true,
        removed_from_store: true,
      }
      const prefsQuery = createChainableMock({ data: partialUpdateResult, error: null })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return createChainableMock({ data: null, error: null })
      })

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'notification_preferences') return prefsQuery
        return createChainableMock({ data: null, error: null })
      })

      const { PUT } = await import('@/app/api/stores/[storeId]/notification-preferences/route')
      // Only send one field — the rest should remain unchanged
      const request = createMockRequest('PUT', undefined, { payslip_available: false })
      const response = await PUT(request, { params: Promise.resolve({ storeId: mockStoreId }) })
      const body = await response.json()

      expect(response.status).toBe(200)
      // The field we updated
      expect(body.data.payslip_available).toBe(false)
      // Other fields remain at their existing values
      expect(body.data.shift_assigned).toBe(true)
      expect(body.data.shift_updated).toBe(true)
      expect(body.data.shift_cancelled).toBe(true)
      expect(body.data.po_supplier_update).toBe(true)
      expect(body.data.delivery_received).toBe(true)
      expect(body.data.removed_from_store).toBe(true)
    })
  })
})
