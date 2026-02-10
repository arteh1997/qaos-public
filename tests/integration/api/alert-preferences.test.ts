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
  const url = new URL('http://localhost:3000/api/stores/store-1/alert-preferences')
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

describe('Alert Preferences API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/stores/[storeId]/alert-preferences', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      })

      const { GET } = await import('@/app/api/stores/[storeId]/alert-preferences/route')
      const request = createMockRequest('GET')
      const response = await GET(request, { params: Promise.resolve({ storeId: mockStoreId }) })
      expect(response.status).toBe(401)
    })

    it('should return default preferences when none exist', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks('Owner')
      const prefsQuery = createChainableMock({ data: null, error: null })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'alert_preferences') return prefsQuery
        return createChainableMock({ data: null, error: null })
      })

      const { GET } = await import('@/app/api/stores/[storeId]/alert-preferences/route')
      const request = createMockRequest('GET')
      const response = await GET(request, { params: Promise.resolve({ storeId: mockStoreId }) })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.low_stock_enabled).toBe(true)
      expect(body.data.critical_stock_enabled).toBe(true)
      expect(body.data.alert_frequency).toBe('daily')
      expect(body.data.is_default).toBe(true)
    })

    it('should return existing preferences', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks('Owner')

      const savedPrefs = {
        id: 'pref-1',
        store_id: mockStoreId,
        user_id: mockUserId,
        low_stock_enabled: false,
        critical_stock_enabled: true,
        missing_count_enabled: true,
        low_stock_threshold: 0.5,
        alert_frequency: 'weekly',
        email_enabled: true,
        preferred_hour: 14,
      }
      const prefsQuery = createChainableMock({ data: savedPrefs, error: null })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'alert_preferences') return prefsQuery
        return createChainableMock({ data: null, error: null })
      })

      const { GET } = await import('@/app/api/stores/[storeId]/alert-preferences/route')
      const request = createMockRequest('GET')
      const response = await GET(request, { params: Promise.resolve({ storeId: mockStoreId }) })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.low_stock_enabled).toBe(false)
      expect(body.data.alert_frequency).toBe('weekly')
      expect(body.data.preferred_hour).toBe(14)
    })

    it('should reject Staff role', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks('Staff')

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return createChainableMock({ data: null, error: null })
      })

      const { GET } = await import('@/app/api/stores/[storeId]/alert-preferences/route')
      const request = createMockRequest('GET')
      const response = await GET(request, { params: Promise.resolve({ storeId: mockStoreId }) })
      expect(response.status).toBe(403)
    })
  })

  describe('PUT /api/stores/[storeId]/alert-preferences', () => {
    it('should update preferences', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks('Owner')

      const updatedPrefs = {
        id: 'pref-1',
        store_id: mockStoreId,
        user_id: mockUserId,
        low_stock_enabled: false,
        alert_frequency: 'weekly',
      }
      const prefsQuery = createChainableMock({ data: updatedPrefs, error: null })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'alert_preferences') return prefsQuery
        return createChainableMock({ data: null, error: null })
      })

      const { PUT } = await import('@/app/api/stores/[storeId]/alert-preferences/route')
      const request = createMockRequest('PUT', undefined, { low_stock_enabled: false, alert_frequency: 'weekly' })
      const response = await PUT(request, { params: Promise.resolve({ storeId: mockStoreId }) })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.low_stock_enabled).toBe(false)
    })

    it('should reject invalid threshold', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks('Owner')

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return createChainableMock({ data: null, error: null })
      })

      const { PUT } = await import('@/app/api/stores/[storeId]/alert-preferences/route')
      const request = createMockRequest('PUT', undefined, { low_stock_threshold: 5.0 })
      const response = await PUT(request, { params: Promise.resolve({ storeId: mockStoreId }) })

      expect(response.status).toBe(400)
    })
  })
})
