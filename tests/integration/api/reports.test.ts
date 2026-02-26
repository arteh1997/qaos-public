import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Create chainable query builder mock
function createChainableMock(resolvedValue: unknown = { data: null, error: null }) {
  const mock: Record<string, ReturnType<typeof vi.fn>> & { then?: typeof Promise.prototype.then } = {}
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

  // Make the mock thenable so it can be awaited without calling .single()
  mock.then = (resolve: (value: unknown) => unknown) => Promise.resolve(resolvedValue).then(resolve)

  return mock
}

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}))

// Mock rate limit
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({
    success: true,
    remaining: 9,
    resetTime: Date.now() + 60000,
    limit: 10,
  })),
  RATE_LIMITS: {
    api: { limit: 100, windowMs: 60000 },
    reports: { limit: 10, windowMs: 60000 },
  },
  getRateLimitHeaders: vi.fn(() => ({})),
}))

// Helper to create mock NextRequest
function createMockRequest(
  method: string,
  path: string,
  searchParams?: Record<string, string>
): NextRequest {
  const url = new URL(`http://localhost:3000${path}`)
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  return {
    method,
    nextUrl: url,
    url: url.toString(),
    headers: new Headers(),
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as NextRequest
}

// Setup authenticated user with specific role
function setupAuthenticatedUser(role: string) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-123', email: 'test@example.com' } },
    error: null,
  })

  const profileQuery = createChainableMock({
    data: {
      id: 'user-123',
      role,
      store_id: null,
      is_platform_admin: false,
      default_store_id: null,
    },
    error: null,
  })

  const storeUsersQuery = createChainableMock({
    data: [
      {
        id: 'su-1',
        store_id: 'store-1',
        user_id: 'user-123',
        role,
        is_billing_owner: role === 'Owner',
        store: { id: 'store-1', name: 'Test Store', is_active: true },
      },
    ],
    error: null,
  })

  return { profileQuery, storeUsersQuery }
}

describe('Reports API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/reports/low-stock', () => {
    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        })

        const { GET } = await import('@/app/api/reports/low-stock/route')

        const request = createMockRequest('GET', '/api/reports/low-stock', {
          store_id: 'store-1',
        })
        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.code).toBe('UNAUTHORIZED')
      })
    })

    describe('Authorization', () => {
      it('should allow Staff users to view low stock reports', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        const reportsQuery = createChainableMock({
          data: [],
          error: null,
        })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'store_inventory') return reportsQuery
          return profileQuery
        })

        const { GET } = await import('@/app/api/reports/low-stock/route')

        const request = createMockRequest('GET', '/api/reports/low-stock', {
          store_id: 'store-1',
        })
        const response = await GET(request)

        expect(response.status).toBe(200)
      })
    })

    describe('Successful Requests', () => {
      it('should return low stock report for Owner', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        const reportsQuery = createChainableMock({
          data: [
            {
              id: 'item-1',
              name: 'Low Stock Item',
              category: 'Produce',
              current_quantity: 5,
              minimum_quantity: 10,
            },
          ],
          count: 1,
          error: null,
        })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'store_inventory' || table === 'inventory_items') return reportsQuery
          return reportsQuery
        })

        const { GET } = await import('@/app/api/reports/low-stock/route')

        const request = createMockRequest('GET', '/api/reports/low-stock', {
          store_id: 'store-1',
        })
        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
      })

      it('should return low stock report for Manager', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Manager')

        const reportsQuery = createChainableMock({
          data: [],
          count: 0,
          error: null,
        })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return reportsQuery
        })

        const { GET } = await import('@/app/api/reports/low-stock/route')

        const request = createMockRequest('GET', '/api/reports/low-stock', {
          store_id: 'store-1',
        })
        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
      })

      it('should return low stock report for Staff', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        const reportsQuery = createChainableMock({
          data: [],
          count: 0,
          error: null,
        })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return reportsQuery
        })

        const { GET } = await import('@/app/api/reports/low-stock/route')

        const request = createMockRequest('GET', '/api/reports/low-stock', {
          store_id: 'store-1',
        })
        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
      })
    })
  })
})
