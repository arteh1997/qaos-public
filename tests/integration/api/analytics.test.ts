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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mock.then = ((resolve?: any) => Promise.resolve(resolvedValue).then(resolve)) as any
  return mock
}

function createMockRequest(searchParams?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/reports/analytics')
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
    reports: { limit: 30, windowMs: 60000 },
  },
  getRateLimitHeaders: vi.fn(() => ({
    'X-RateLimit-Limit': '30',
    'X-RateLimit-Remaining': '29',
    'X-RateLimit-Reset': String(Date.now() + 60000),
  })),
}))

vi.mock('@/lib/csrf', () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
}))

const mockStoreId = '550e8400-e29b-41d4-a716-446655440000'
const mockUserId = '660e8400-e29b-41d4-a716-446655440000'

function setupAuthMocks(role: string = 'Owner') {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: mockUserId, email: 'owner@example.com' } },
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

  const storeUsersData = [{ id: 'su-1', store_id: mockStoreId, user_id: mockUserId, role, store: { id: mockStoreId, name: 'Test Store', is_active: true } }]
  const storeUsersQuery = createChainableMock({
    data: storeUsersData,
    error: null,
  })

  storeUsersQuery.single = vi.fn().mockResolvedValue({
    data: storeUsersData[0],
    error: null,
  })

  return { profileQuery, storeUsersQuery }
}

describe('Analytics API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/reports/analytics', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      })

      const { GET } = await import('@/app/api/reports/analytics/route')
      const request = createMockRequest({ store_id: mockStoreId })
      const response = await GET(request)
      expect(response.status).toBe(401)
    })

    it('should return 400 when store_id is missing', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks('Owner')

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return createChainableMock({ data: [], error: null })
      })

      const { GET } = await import('@/app/api/reports/analytics/route')
      const request = createMockRequest() // No store_id
      const response = await GET(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.message).toContain('store_id')
    })

    it('should return analytics data for authorized user', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks('Owner')

      const stockHistoryData = [
        {
          id: 'sh-1', action_type: 'Count', quantity_before: 10, quantity_after: 8,
          quantity_change: -2, inventory_item_id: 'item-1', created_at: new Date().toISOString(),
          inventory_item: { name: 'Tomatoes', category: 'Produce' },
        },
        {
          id: 'sh-2', action_type: 'Reception', quantity_before: 5, quantity_after: 15,
          quantity_change: 10, inventory_item_id: 'item-2', created_at: new Date().toISOString(),
          inventory_item: { name: 'Chicken', category: 'Proteins' },
        },
      ]
      const inventoryData = [
        { inventory_item_id: 'item-1', quantity: 8, par_level: 10, inventory_item: { name: 'Tomatoes', category: 'Produce', is_active: true } },
        { inventory_item_id: 'item-2', quantity: 15, par_level: 5, inventory_item: { name: 'Chicken', category: 'Proteins', is_active: true } },
        { inventory_item_id: 'item-3', quantity: 0, par_level: 3, inventory_item: { name: 'Milk', category: 'Dairy', is_active: true } },
      ]
      const dailyCountsData = [{ count_date: new Date().toISOString().split('T')[0] }]
      const categoryData = [{ category: 'Produce' }, { category: 'Proteins' }, { category: 'Dairy' }]

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'stock_history') return createChainableMock({ data: stockHistoryData, error: null })
        if (table === 'store_inventory') return createChainableMock({ data: inventoryData, error: null })
        if (table === 'daily_counts') return createChainableMock({ data: dailyCountsData, error: null })
        if (table === 'inventory_items') return createChainableMock({ data: categoryData, error: null })
        return createChainableMock({ data: [], error: null })
      })

      const { GET } = await import('@/app/api/reports/analytics/route')
      const request = createMockRequest({ store_id: mockStoreId, days: '30' })
      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)

      // Verify structure
      expect(body.data.period.days).toBe(30)
      expect(body.data.stockActivityByDay).toBeInstanceOf(Array)
      expect(body.data.topMovingItems).toBeInstanceOf(Array)
      expect(body.data.categoryBreakdown).toBeInstanceOf(Array)
      expect(body.data.inventoryHealth).toBeDefined()
      expect(body.data.countCompletionRate).toBeDefined()
      expect(body.data.stockValueTrend).toBeInstanceOf(Array)

      // Verify inventory health computation
      expect(body.data.inventoryHealth.total).toBe(3)
      expect(body.data.inventoryHealth.outOfStock).toBe(1) // Milk at 0
      expect(body.data.inventoryHealth.lowStock).toBe(1)   // Tomatoes below par
      expect(body.data.inventoryHealth.healthy).toBe(1)     // Chicken above par

      // Verify category breakdown
      expect(body.data.categoryBreakdown.length).toBe(3)

      // Verify top moving items
      expect(body.data.topMovingItems.length).toBe(2)
      expect(body.data.topMovingItems[0].name).toBe('Chicken') // 10 units > 2
    })

    it('should reject Staff role', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks('Staff')

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return createChainableMock({ data: [], error: null })
      })

      const { GET } = await import('@/app/api/reports/analytics/route')
      const request = createMockRequest({ store_id: mockStoreId })
      const response = await GET(request)

      expect(response.status).toBe(403)
    })

    it('should clamp days to max 90', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks('Owner')

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return createChainableMock({ data: [], error: null })
      })

      const { GET } = await import('@/app/api/reports/analytics/route')
      const request = createMockRequest({ store_id: mockStoreId, days: '365' })
      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.period.days).toBe(90)
    })

    it('should handle empty data gracefully', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks('Owner')

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return createChainableMock({ data: [], error: null })
      })

      const { GET } = await import('@/app/api/reports/analytics/route')
      const request = createMockRequest({ store_id: mockStoreId })
      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.inventoryHealth.total).toBe(0)
      expect(body.data.topMovingItems).toEqual([])
      expect(body.data.categoryBreakdown).toEqual([])
      expect(body.data.countCompletionRate.rate).toBe(0)
    })
  })
})
