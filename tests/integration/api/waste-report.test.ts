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

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => createChainableMock({ error: null })),
  })),
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

vi.mock('@/lib/audit', () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
  computeFieldChanges: vi.fn().mockReturnValue([]),
}))

vi.mock('@/lib/csrf', () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
  getCSRFToken: vi.fn().mockResolvedValue('test-csrf-token'),
}))

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
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as NextRequest
}

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

describe('Waste Report API', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  describe('POST /api/stores/[storeId]/waste', () => {
    const STORE_UUID = '11111111-1111-4111-a111-111111111111'
    const ITEM_UUID_1 = '22222222-2222-4222-a222-222222222222'
    const ITEM_UUID_2 = '33333333-3333-4333-a333-333333333333'

    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const { POST } = await import('@/app/api/stores/[storeId]/waste/route')

      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/waste`, {
        items: [{ inventory_item_id: ITEM_UUID_1, quantity: 2, reason: 'spoilage' }],
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.code).toBe('UNAUTHORIZED')
    })

    it('should return 400 for empty items array', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff', STORE_UUID)

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/waste/route')

      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/waste`, {
        items: [],
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.code).toBe('BAD_REQUEST')
    })

    it('should return 400 for negative quantity', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff', STORE_UUID)

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/waste/route')

      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/waste`, {
        items: [{ inventory_item_id: ITEM_UUID_1, quantity: -5 }],
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.code).toBe('BAD_REQUEST')
    })

    it('should record waste report for Staff', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff', STORE_UUID)

      const inventoryItemsQuery = createChainableMock({
        data: [{ id: ITEM_UUID_1 }],
        error: null,
      })

      const storeInventoryQuery = createChainableMock({
        data: [{ inventory_item_id: ITEM_UUID_1, quantity: 10 }],
        error: null,
      })
      storeInventoryQuery.upsert = vi.fn().mockResolvedValue({ error: null })

      const stockHistoryQuery = createChainableMock({ error: null })
      stockHistoryQuery.insert = vi.fn().mockResolvedValue({ error: null })

      const wasteLogQuery = createChainableMock({ error: null })
      wasteLogQuery.insert = vi.fn().mockResolvedValue({ error: null })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'inventory_items') return inventoryItemsQuery
        if (table === 'store_inventory') return storeInventoryQuery
        if (table === 'stock_history') return stockHistoryQuery
        if (table === 'waste_log') return wasteLogQuery
        return storeUsersQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/waste/route')

      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/waste`, {
        items: [{ inventory_item_id: ITEM_UUID_1, quantity: 3, reason: 'spoilage' }],
        notes: 'Found spoiled tomatoes',
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.message).toBe('Waste report recorded successfully')
      expect(data.data.itemsReported).toBe(1)
      expect(data.data.totalWasted).toBe(3)
    })

    it('should record waste report for Owner with multiple items', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const inventoryItemsQuery = createChainableMock({
        data: [{ id: ITEM_UUID_1 }, { id: ITEM_UUID_2 }],
        error: null,
      })

      const storeInventoryQuery = createChainableMock({
        data: [
          { inventory_item_id: ITEM_UUID_1, quantity: 10 },
          { inventory_item_id: ITEM_UUID_2, quantity: 5 },
        ],
        error: null,
      })
      storeInventoryQuery.upsert = vi.fn().mockResolvedValue({ error: null })

      const stockHistoryQuery = createChainableMock({ error: null })
      stockHistoryQuery.insert = vi.fn().mockResolvedValue({ error: null })

      const wasteLogQuery = createChainableMock({ error: null })
      wasteLogQuery.insert = vi.fn().mockResolvedValue({ error: null })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'inventory_items') return inventoryItemsQuery
        if (table === 'store_inventory') return storeInventoryQuery
        if (table === 'stock_history') return stockHistoryQuery
        if (table === 'waste_log') return wasteLogQuery
        return storeUsersQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/waste/route')

      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/waste`, {
        items: [
          { inventory_item_id: ITEM_UUID_1, quantity: 2, reason: 'expired' },
          { inventory_item_id: ITEM_UUID_2, quantity: 1, reason: 'damaged' },
        ],
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.itemsReported).toBe(2)
      expect(data.data.totalWasted).toBe(3)
    })

    it('should floor inventory at 0 when waste exceeds current stock', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Manager', STORE_UUID)

      const inventoryItemsQuery = createChainableMock({
        data: [{ id: ITEM_UUID_1 }],
        error: null,
      })

      // Current stock is only 2, but reporting waste of 5
      const storeInventoryQuery = createChainableMock({
        data: [{ inventory_item_id: ITEM_UUID_1, quantity: 2 }],
        error: null,
      })
      storeInventoryQuery.upsert = vi.fn().mockResolvedValue({ error: null })

      const stockHistoryQuery = createChainableMock({ error: null })
      stockHistoryQuery.insert = vi.fn().mockResolvedValue({ error: null })

      const wasteLogQuery = createChainableMock({ error: null })
      wasteLogQuery.insert = vi.fn().mockResolvedValue({ error: null })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'inventory_items') return inventoryItemsQuery
        if (table === 'store_inventory') return storeInventoryQuery
        if (table === 'stock_history') return stockHistoryQuery
        if (table === 'waste_log') return wasteLogQuery
        return storeUsersQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/waste/route')

      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/waste`, {
        items: [{ inventory_item_id: ITEM_UUID_1, quantity: 5, reason: 'overproduction' }],
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })

      expect(response.status).toBe(201)
      // Verify the upsert was called - inventory should be floored at 0
      expect(storeInventoryQuery.upsert).toHaveBeenCalled()
    })
  })

  describe('GET /api/stores/[storeId]/waste', () => {
    const STORE_UUID = '11111111-1111-4111-a111-111111111111'

    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const { GET } = await import('@/app/api/stores/[storeId]/waste/route')

      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/waste`)
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.code).toBe('UNAUTHORIZED')
    })

    it('should return 403 for Staff users', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff', STORE_UUID)

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const { GET } = await import('@/app/api/stores/[storeId]/waste/route')

      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/waste`)
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.code).toBe('FORBIDDEN')
    })

    it('should return waste history for Owner', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const wasteLogQuery = createChainableMock({
        data: [
          {
            id: 'wl-1',
            store_id: STORE_UUID,
            inventory_item_id: 'item-1',
            quantity: 3,
            reason: 'spoilage',
            notes: 'Test',
            reported_by: 'user-123',
            reported_at: '2026-02-10T10:00:00Z',
            inventory_item: { id: 'item-1', name: 'Tomatoes', category: 'Produce', unit_of_measure: 'kg' },
          },
        ],
        error: null,
        count: 1,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'waste_log') return wasteLogQuery
        return storeUsersQuery
      })

      const { GET } = await import('@/app/api/stores/[storeId]/waste/route')

      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/waste`)
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].reason).toBe('spoilage')
    })

    it('should filter waste history by reason', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Manager', STORE_UUID)

      const wasteLogQuery = createChainableMock({
        data: [],
        error: null,
        count: 0,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'waste_log') return wasteLogQuery
        return storeUsersQuery
      })

      const { GET } = await import('@/app/api/stores/[storeId]/waste/route')

      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/waste`, undefined, {
        reason: 'expired',
      })
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // Verify the eq filter was applied for reason
      expect(wasteLogQuery.eq).toHaveBeenCalled()
    })
  })
})
