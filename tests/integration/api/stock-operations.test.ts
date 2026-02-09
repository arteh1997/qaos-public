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

// Mock admin client for audit logging
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => createChainableMock({ error: null })),
  })),
}))

// Mock rate limit to always allow
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

// Mock audit logging
vi.mock('@/lib/audit', () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}))

// Helper to create mock NextRequest
function createMockRequest(
  method: string,
  path: string,
  body?: object,
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
    json: vi.fn(() => Promise.resolve(body || {})),
    headers: new Headers(),
  } as unknown as NextRequest
}

// Setup authenticated user with specific role
function setupAuthenticatedUser(role: string, storeId: string = 'store-123') {
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
        store_id: storeId,
        user_id: 'user-123',
        role,
        is_billing_owner: role === 'Owner',
        store: { id: storeId, name: 'Test Store', is_active: true },
      },
    ],
    error: null,
  })

  return { profileQuery, storeUsersQuery }
}

describe('Stock Operations API Integration Tests', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  describe('POST /api/stores/[storeId]/stock-count', () => {
    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        })

        const { POST } = await import('@/app/api/stores/[storeId]/stock-count/route')

        const request = createMockRequest('POST', '/api/stores/store-123/stock-count', {
          items: [{ inventory_item_id: 'item-1', quantity: 10 }],
        })
        const response = await POST(request, { params: Promise.resolve({ storeId: 'store-123' }) })
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.code).toBe('UNAUTHORIZED')
      })
    })

    describe('Authorization', () => {
      it('should return 403 for Driver users', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Driver')

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return profileQuery
        })

        const { POST } = await import('@/app/api/stores/[storeId]/stock-count/route')

        const request = createMockRequest('POST', '/api/stores/store-123/stock-count', {
          items: [{ inventory_item_id: 'item-1', quantity: 10 }],
        })
        const response = await POST(request, { params: Promise.resolve({ storeId: 'store-123' }) })
        const data = await response.json()

        expect(response.status).toBe(403)
        expect(data.code).toBe('FORBIDDEN')
      })
    })

    describe('Validation', () => {
      it('should return 400 for empty items array', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return profileQuery
        })

        const { POST } = await import('@/app/api/stores/[storeId]/stock-count/route')

        const request = createMockRequest('POST', '/api/stores/store-123/stock-count', {
          items: [],
        })
        const response = await POST(request, { params: Promise.resolve({ storeId: 'store-123' }) })
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.code).toBe('BAD_REQUEST')
      })

      it('should return 400 for invalid quantity', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return profileQuery
        })

        const { POST } = await import('@/app/api/stores/[storeId]/stock-count/route')

        const request = createMockRequest('POST', '/api/stores/store-123/stock-count', {
          items: [{ inventory_item_id: 'item-1', quantity: -5 }],
        })
        const response = await POST(request, { params: Promise.resolve({ storeId: 'store-123' }) })
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.code).toBe('BAD_REQUEST')
      })
    })

    describe('Successful Operation', () => {
      // Use valid UUID format (RFC 4122 compliant - version 4, variant a)
      const STORE_UUID = '11111111-1111-4111-a111-111111111111'
      const ITEM_UUID_1 = '22222222-2222-4222-a222-222222222222'
      const ITEM_UUID_2 = '33333333-3333-4333-a333-333333333333'
      const ITEM_UUID_3 = '44444444-4444-4444-a444-444444444444'

      it('should create stock count for Staff', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff', STORE_UUID)

        // Mock inventory_items to return active items
        const inventoryItemsQuery = createChainableMock({
          data: [{ id: ITEM_UUID_1 }],
          error: null,
        })

        // Mock store_inventory for current levels
        const storeInventoryQuery = createChainableMock({
          data: [{ inventory_item_id: ITEM_UUID_1, quantity: 5 }],
          error: null,
        })
        storeInventoryQuery.upsert = vi.fn().mockResolvedValue({ error: null })

        // Mock stock_history insert
        const stockHistoryQuery = createChainableMock({ error: null })
        stockHistoryQuery.insert = vi.fn().mockResolvedValue({ error: null })

        // Mock daily_counts upsert
        const dailyCountsQuery = createChainableMock({ error: null })
        dailyCountsQuery.upsert = vi.fn().mockResolvedValue({ error: null })

        // Mock store_users for re-verification (returns single)
        const storeUsersVerifyQuery = createChainableMock({
          data: { id: 'su-1' },
          error: null,
        })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') {
            // First call is for auth (returns array), second is for re-verification (returns single)
            return storeUsersQuery
          }
          if (table === 'inventory_items') return inventoryItemsQuery
          if (table === 'store_inventory') return storeInventoryQuery
          if (table === 'stock_history') return stockHistoryQuery
          if (table === 'daily_counts') return dailyCountsQuery
          return storeUsersVerifyQuery
        })

        const { POST } = await import('@/app/api/stores/[storeId]/stock-count/route')

        const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/stock-count`, {
          items: [{ inventory_item_id: ITEM_UUID_1, quantity: 10 }],
        })
        const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
        const data = await response.json()

        expect(response.status).toBe(201)
        expect(data.success).toBe(true)
      })

      it('should create stock count for Owner', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

        // Mock inventory_items to return active items
        const inventoryItemsQuery = createChainableMock({
          data: [{ id: ITEM_UUID_2 }],
          error: null,
        })

        // Mock store_inventory for current levels
        const storeInventoryQuery = createChainableMock({
          data: [{ inventory_item_id: ITEM_UUID_2, quantity: 10 }],
          error: null,
        })
        storeInventoryQuery.upsert = vi.fn().mockResolvedValue({ error: null })

        // Mock stock_history insert
        const stockHistoryQuery = createChainableMock({ error: null })
        stockHistoryQuery.insert = vi.fn().mockResolvedValue({ error: null })

        // Mock daily_counts upsert
        const dailyCountsQuery = createChainableMock({ error: null })
        dailyCountsQuery.upsert = vi.fn().mockResolvedValue({ error: null })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'inventory_items') return inventoryItemsQuery
          if (table === 'store_inventory') return storeInventoryQuery
          if (table === 'stock_history') return stockHistoryQuery
          if (table === 'daily_counts') return dailyCountsQuery
          return storeUsersQuery
        })

        const { POST } = await import('@/app/api/stores/[storeId]/stock-count/route')

        const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/stock-count`, {
          items: [{ inventory_item_id: ITEM_UUID_2, quantity: 25 }],
        })
        const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
        const data = await response.json()

        expect(response.status).toBe(201)
        expect(data.success).toBe(true)
      })

      it('should create stock count for Manager', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Manager', STORE_UUID)

        // Mock inventory_items to return active items
        const inventoryItemsQuery = createChainableMock({
          data: [{ id: ITEM_UUID_3 }],
          error: null,
        })

        // Mock store_inventory for current levels
        const storeInventoryQuery = createChainableMock({
          data: [{ inventory_item_id: ITEM_UUID_3, quantity: 8 }],
          error: null,
        })
        storeInventoryQuery.upsert = vi.fn().mockResolvedValue({ error: null })

        // Mock stock_history insert
        const stockHistoryQuery = createChainableMock({ error: null })
        stockHistoryQuery.insert = vi.fn().mockResolvedValue({ error: null })

        // Mock daily_counts upsert
        const dailyCountsQuery = createChainableMock({ error: null })
        dailyCountsQuery.upsert = vi.fn().mockResolvedValue({ error: null })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'inventory_items') return inventoryItemsQuery
          if (table === 'store_inventory') return storeInventoryQuery
          if (table === 'stock_history') return stockHistoryQuery
          if (table === 'daily_counts') return dailyCountsQuery
          return storeUsersQuery
        })

        const { POST } = await import('@/app/api/stores/[storeId]/stock-count/route')

        const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/stock-count`, {
          items: [{ inventory_item_id: ITEM_UUID_3, quantity: 15 }],
        })
        const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
        const data = await response.json()

        expect(response.status).toBe(201)
        expect(data.success).toBe(true)
      })
    })
  })
})
