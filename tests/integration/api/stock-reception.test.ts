import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Valid UUIDs for testing (RFC 4122 compliant - version 4, variant a)
const STORE_UUID = '11111111-1111-4111-a111-111111111111'
const ITEM_UUID_1 = '22222222-2222-4222-a222-222222222222'
const ITEM_UUID_2 = '33333333-3333-4333-a333-333333333333'

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
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
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
    remaining: 99,
    resetTime: Date.now() + 60000,
    limit: 100,
  })),
  RATE_LIMITS: {
    api: { limit: 100, windowMs: 60000 },
  },
  getRateLimitHeaders: vi.fn(() => ({})),
}))

// Mock CSRF validation
vi.mock('@/lib/csrf', () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
  getCSRFToken: vi.fn().mockResolvedValue('test-csrf-token'),
}))

// Helper to create mock NextRequest
function createMockRequest(body?: object, storeId: string = STORE_UUID): NextRequest {
  const url = new URL(`http://localhost:3000/api/stores/${storeId}/stock-reception`)

  return {
    method: 'POST',
    nextUrl: url,
    url: url.toString(),
    json: vi.fn(() => Promise.resolve(body || {})),
    headers: new Headers(),
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as NextRequest
}

// Helper to setup authenticated user with specific role
function setupAuthenticatedUser(role: string, storeId: string = STORE_UUID, stores: object[] = []) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-123', email: 'test@example.com' } },
    error: null,
  })

  const profileQuery = createChainableMock({
    data: { role, store_id: null, is_platform_admin: false, default_store_id: null },
    error: null,
  })

  const storeUsersQuery = createChainableMock({
    data: stores.length > 0 ? stores : [
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

describe('Stock Reception API Tests', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  describe('POST /api/stores/:storeId/stock-reception', () => {
    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        })

        const { POST } = await import('@/app/api/stores/[storeId]/stock-reception/route')

        const request = createMockRequest({
          items: [{ inventory_item_id: ITEM_UUID_1, quantity: 10 }],
        })
        const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.success).toBe(false)
        expect(data.code).toBe('UNAUTHORIZED')
      })
    })

    describe('Authorization', () => {
      it('should allow Owner users', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        const activeItemsQuery = createChainableMock({
          data: [{ id: ITEM_UUID_1 }],
          error: null,
        })

        const currentInventoryQuery = createChainableMock({
          data: [{ inventory_item_id: ITEM_UUID_1, quantity: 5 }],
          error: null,
        })
        currentInventoryQuery.upsert = vi.fn().mockResolvedValue({ error: null })

        const stockHistoryQuery = createChainableMock({ error: null })
        stockHistoryQuery.insert = vi.fn().mockResolvedValue({ error: null })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'inventory_items') return activeItemsQuery
          if (table === 'store_inventory') return currentInventoryQuery
          if (table === 'stock_history') return stockHistoryQuery
          return storeUsersQuery
        })

        const { POST } = await import('@/app/api/stores/[storeId]/stock-reception/route')

        const request = createMockRequest({
          items: [{ inventory_item_id: ITEM_UUID_1, quantity: 10 }],
        })
        const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
        const data = await response.json()

        expect(response.status).toBe(201)
        expect(data.success).toBe(true)
      })

      it('should allow Staff users', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        const activeItemsQuery = createChainableMock({
          data: [{ id: ITEM_UUID_1 }],
          error: null,
        })

        const currentInventoryQuery = createChainableMock({
          data: [],
          error: null,
        })
        currentInventoryQuery.upsert = vi.fn().mockResolvedValue({ error: null })

        const stockHistoryQuery = createChainableMock({ error: null })
        stockHistoryQuery.insert = vi.fn().mockResolvedValue({ error: null })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'inventory_items') return activeItemsQuery
          if (table === 'store_inventory') return currentInventoryQuery
          if (table === 'stock_history') return stockHistoryQuery
          return storeUsersQuery
        })

        const { POST } = await import('@/app/api/stores/[storeId]/stock-reception/route')

        const request = createMockRequest({
          items: [{ inventory_item_id: ITEM_UUID_1, quantity: 50 }],
        })
        const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
        const data = await response.json()

        expect(response.status).toBe(201)
        expect(data.success).toBe(true)
      })
    })

    describe('Validation', () => {
      beforeEach(() => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return profileQuery
        })
      })

      it('should return 400 for empty items array', async () => {
        const { POST } = await import('@/app/api/stores/[storeId]/stock-reception/route')

        const request = createMockRequest({
          items: [],
        })
        const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.code).toBe('BAD_REQUEST')
      })

      it('should return 400 for negative quantity', async () => {
        const { POST } = await import('@/app/api/stores/[storeId]/stock-reception/route')

        const request = createMockRequest({
          items: [{ inventory_item_id: ITEM_UUID_1, quantity: -5 }],
        })
        const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.code).toBe('BAD_REQUEST')
      })
    })

    describe('Deleted Items Check', () => {
      it('should return 400 if items have been deleted', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        // Return empty array - items not found (deleted)
        const activeItemsQuery = createChainableMock({
          data: [], // No active items found
          error: null,
        })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'inventory_items') return activeItemsQuery
          return profileQuery
        })

        const { POST } = await import('@/app/api/stores/[storeId]/stock-reception/route')

        // Use a valid UUID format for the deleted item (RFC 4122 compliant)
        const DELETED_ITEM_UUID = '99999999-9999-4999-a999-999999999999'
        const request = createMockRequest({
          items: [{ inventory_item_id: DELETED_ITEM_UUID, quantity: 10 }],
        })
        const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
        const data = await response.json()

        expect(response.status).toBe(400)
        // API returns validation error about inactive/deleted items
        expect(data.message).toMatch(/deleted|inactive|not found|invalid/i)
      })
    })

    describe('Access Revocation Check', () => {
      it('should return 403 if access was revoked mid-operation', async () => {
        // Set up user with no access to the target store
        // User has access to a different store but not the one being accessed
        const OTHER_STORE_UUID = '88888888-8888-4888-a888-888888888888'
        const { profileQuery } = setupAuthenticatedUser('Owner', OTHER_STORE_UUID)

        const storeUsersQuery = createChainableMock({
          data: [
            {
              id: 'su-1',
              store_id: OTHER_STORE_UUID, // Different store
              user_id: 'user-123',
              role: 'Owner',
              is_billing_owner: true,
              store: { id: OTHER_STORE_UUID, name: 'Other Store', is_active: true },
            },
          ],
          error: null,
        })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return profileQuery
        })

        const { POST } = await import('@/app/api/stores/[storeId]/stock-reception/route')

        const request = createMockRequest({
          items: [{ inventory_item_id: ITEM_UUID_1, quantity: 10 }],
        })
        const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
        const data = await response.json()

        expect(response.status).toBe(403)
        expect(data.message).toContain('do not have access')
      })
    })

    describe('Successful Reception', () => {
      it('should record stock reception and return summary', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Manager')

        const activeItemsQuery = createChainableMock({
          data: [{ id: ITEM_UUID_1 }, { id: ITEM_UUID_2 }],
          error: null,
        })

        const currentInventoryQuery = createChainableMock({
          data: [
            { inventory_item_id: ITEM_UUID_1, quantity: 10 },
            { inventory_item_id: ITEM_UUID_2, quantity: 20 },
          ],
          error: null,
        })
        currentInventoryQuery.upsert = vi.fn().mockResolvedValue({ error: null })

        const stockHistoryQuery = createChainableMock({ error: null })
        stockHistoryQuery.insert = vi.fn().mockResolvedValue({ error: null })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'inventory_items') return activeItemsQuery
          if (table === 'store_inventory') return currentInventoryQuery
          if (table === 'stock_history') return stockHistoryQuery
          return storeUsersQuery
        })

        const { POST } = await import('@/app/api/stores/[storeId]/stock-reception/route')

        const request = createMockRequest({
          items: [
            { inventory_item_id: ITEM_UUID_1, quantity: 100 },
            { inventory_item_id: ITEM_UUID_2, quantity: 50 },
          ],
          notes: 'Delivery from supplier',
        })
        const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
        const data = await response.json()

        expect(response.status).toBe(201)
        expect(data.success).toBe(true)
        expect(data.data.itemsReceived).toBe(2)
        expect(data.data.totalQuantity).toBe(150)
      })

      it('should update unit_cost when total_cost is provided', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        const activeItemsQuery = createChainableMock({
          data: [{ id: ITEM_UUID_1 }],
          error: null,
        })

        const currentInventoryQuery = createChainableMock({
          data: [{ inventory_item_id: ITEM_UUID_1, quantity: 0 }],
          error: null,
        })
        currentInventoryQuery.upsert = vi.fn().mockResolvedValue({ error: null })
        currentInventoryQuery.update = vi.fn(() => currentInventoryQuery)

        const stockHistoryQuery = createChainableMock({ error: null })
        stockHistoryQuery.insert = vi.fn().mockResolvedValue({ error: null })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'inventory_items') return activeItemsQuery
          if (table === 'store_inventory') return currentInventoryQuery
          if (table === 'stock_history') return stockHistoryQuery
          return storeUsersQuery
        })

        const { POST } = await import('@/app/api/stores/[storeId]/stock-reception/route')

        const request = createMockRequest({
          items: [{ inventory_item_id: ITEM_UUID_1, quantity: 50, total_cost: 20 }],
        })
        const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
        const data = await response.json()

        expect(response.status).toBe(201)
        expect(data.success).toBe(true)

        // Verify cost update was called on store_inventory
        expect(currentInventoryQuery.update).toHaveBeenCalledWith(
          expect.objectContaining({ unit_cost: 0.4, cost_currency: 'GBP' })
        )
      })

      it('should not update unit_cost when total_cost is not provided', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        const activeItemsQuery = createChainableMock({
          data: [{ id: ITEM_UUID_1 }],
          error: null,
        })

        const currentInventoryQuery = createChainableMock({
          data: [{ inventory_item_id: ITEM_UUID_1, quantity: 5 }],
          error: null,
        })
        currentInventoryQuery.upsert = vi.fn().mockResolvedValue({ error: null })
        currentInventoryQuery.update = vi.fn(() => currentInventoryQuery)

        const stockHistoryQuery = createChainableMock({ error: null })
        stockHistoryQuery.insert = vi.fn().mockResolvedValue({ error: null })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'inventory_items') return activeItemsQuery
          if (table === 'store_inventory') return currentInventoryQuery
          if (table === 'stock_history') return stockHistoryQuery
          return storeUsersQuery
        })

        const { POST } = await import('@/app/api/stores/[storeId]/stock-reception/route')

        const request = createMockRequest({
          items: [{ inventory_item_id: ITEM_UUID_1, quantity: 10 }],
        })
        const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })

        expect(response.status).toBe(201)
        // update should NOT have been called for cost since no total_cost was given
        expect(currentInventoryQuery.update).not.toHaveBeenCalled()
      })

      it('should filter out zero quantity items', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        const activeItemsQuery = createChainableMock({
          data: [{ id: ITEM_UUID_1 }],
          error: null,
        })

        const currentInventoryQuery = createChainableMock({
          data: [{ inventory_item_id: ITEM_UUID_1, quantity: 5 }],
          error: null,
        })
        currentInventoryQuery.upsert = vi.fn().mockResolvedValue({ error: null })

        const stockHistoryQuery = createChainableMock({ error: null })
        stockHistoryQuery.insert = vi.fn().mockResolvedValue({ error: null })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'inventory_items') return activeItemsQuery
          if (table === 'store_inventory') return currentInventoryQuery
          if (table === 'stock_history') return stockHistoryQuery
          return storeUsersQuery
        })

        const { POST } = await import('@/app/api/stores/[storeId]/stock-reception/route')

        const request = createMockRequest({
          items: [
            { inventory_item_id: ITEM_UUID_1, quantity: 10 },
            { inventory_item_id: ITEM_UUID_2, quantity: 0 }, // Should be filtered out
          ],
        })
        const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
        const data = await response.json()

        expect(response.status).toBe(201)
        expect(data.data.itemsReceived).toBe(1)
      })
    })
  })
})
