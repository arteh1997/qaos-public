import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Create chainable query builder mock that is also thenable
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
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn(),
  })),
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
function createMockRequest(searchParams?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/reports/daily-summary')
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  return {
    method: 'GET',
    nextUrl: url,
    url: url.toString(),
    json: vi.fn(() => Promise.resolve({})),
    headers: new Headers(),
  } as unknown as NextRequest
}

// Helper to setup authenticated user with specific role
function setupAuthenticatedUser(role: string, stores: object[] = []) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-123', email: 'test@example.com' } },
    error: null,
  })

  const profileQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { role, store_id: null, is_platform_admin: false, default_store_id: null },
      error: null,
    }),
  }

  const storeUsersQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({
      data: stores.length > 0 ? stores : [
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
    }),
  }

  return { profileQuery, storeUsersQuery }
}

describe('Daily Summary Report API Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/reports/daily-summary', () => {
    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        })

        const { GET } = await import('@/app/api/reports/daily-summary/route')

        const request = createMockRequest({ date: '2025-01-15' })
        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.success).toBe(false)
        expect(data.code).toBe('UNAUTHORIZED')
      })
    })

    describe('Authorization', () => {
      it('should return 403 for Staff users', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return profileQuery
        })

        const { GET } = await import('@/app/api/reports/daily-summary/route')

        const request = createMockRequest({ date: '2025-01-15' })
        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(403)
        expect(data.code).toBe('FORBIDDEN')
      })

      it('should allow Owner users', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        const stockHistoryQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }

        const dailyCountsQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'stock_history') return stockHistoryQuery
          if (table === 'daily_counts') return dailyCountsQuery
          return stockHistoryQuery
        })

        const { GET } = await import('@/app/api/reports/daily-summary/route')

        const request = createMockRequest({ date: '2025-01-15' })
        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
      })

      it('should allow Manager users', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Manager')

        const stockHistoryQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }

        const dailyCountsQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'stock_history') return stockHistoryQuery
          if (table === 'daily_counts') return dailyCountsQuery
          return stockHistoryQuery
        })

        const { GET } = await import('@/app/api/reports/daily-summary/route')

        const request = createMockRequest({ date: '2025-01-15' })
        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
      })

      it('should allow Driver users', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Driver')

        const stockHistoryQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }

        const dailyCountsQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'stock_history') return stockHistoryQuery
          if (table === 'daily_counts') return dailyCountsQuery
          return stockHistoryQuery
        })

        const { GET } = await import('@/app/api/reports/daily-summary/route')

        const request = createMockRequest({ date: '2025-01-15' })
        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
      })
    })

    describe('Report Data', () => {
      it('should return stock history grouped by action type', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        // Use chainable mock that can handle .order().eq() chain
        const stockHistoryQuery = createChainableMock({
          data: [
            {
              id: 'sh-1',
              action_type: 'Count',
              quantity_change: -5,
              created_at: '2025-01-15T10:00:00Z',
              inventory_item: { name: 'Tomatoes' },
            },
            {
              id: 'sh-2',
              action_type: 'Reception',
              quantity_change: 100,
              created_at: '2025-01-15T14:00:00Z',
              inventory_item: { name: 'Chicken' },
            },
          ],
          error: null,
        })

        const dailyCountsQuery = createChainableMock({
          data: [{ id: 'dc-1', store_id: 'store-1' }],
          error: null,
        })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'stock_history') return stockHistoryQuery
          if (table === 'daily_counts') return dailyCountsQuery
          return stockHistoryQuery
        })

        const { GET } = await import('@/app/api/reports/daily-summary/route')

        const request = createMockRequest({ date: '2025-01-15', store_id: 'store-1' })
        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.stock_changes).toBeDefined()
      })

      it('should use today if no date provided', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        const stockHistoryQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }

        const dailyCountsQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'stock_history') return stockHistoryQuery
          if (table === 'daily_counts') return dailyCountsQuery
          return stockHistoryQuery
        })

        const { GET } = await import('@/app/api/reports/daily-summary/route')

        const request = createMockRequest() // No date parameter
        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
      })

      it('should filter by store_id when provided', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        // Use chainable mock that can handle .order().eq() chain
        const stockHistoryQuery = createChainableMock({
          data: [],
          error: null,
        })

        const dailyCountsQuery = createChainableMock({
          data: [],
          error: null,
        })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'stock_history') return stockHistoryQuery
          if (table === 'daily_counts') return dailyCountsQuery
          return stockHistoryQuery
        })

        const { GET } = await import('@/app/api/reports/daily-summary/route')

        const request = createMockRequest({ date: '2025-01-15', store_id: 'store-1' })
        const response = await GET(request)

        expect(response.status).toBe(200)
      })
    })
  })
})
