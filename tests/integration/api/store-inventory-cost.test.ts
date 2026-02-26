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
  getCSRFToken: vi.fn().mockResolvedValue('test-csrf-token'),
}))

// Mock admin client for DELETE handler
const mockAdminClient = {
  from: vi.fn(),
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}))

function createMockRequest(body?: object): NextRequest {
  const url = new URL('http://localhost:3000/api/stores/store-1/inventory/item-123')

  return {
    method: 'PATCH',
    nextUrl: url,
    url: url.toString(),
    json: vi.fn(() => Promise.resolve(body || {})),
    headers: new Headers({ 'Content-Type': 'application/json' }),
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as NextRequest
}

function setupAuthenticatedUser(role: string) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-123', email: 'test@example.com' } },
    error: null,
  })

  const profileQuery = createChainableMock({
    data: { role, store_id: null, is_platform_admin: false, default_store_id: null },
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

describe('PATCH /api/stores/:storeId/inventory/:itemId - Cost Update', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Admin client handles audit logging, stock_history, and item name lookups
    mockAdminClient.from.mockReturnValue(createChainableMock({ data: { name: 'Test Item' }, error: null }))
  })

  it('should update cost when store_inventory record exists', async () => {
    const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

    const updateQuery = createChainableMock({
      data: {
        store_id: 'store-1',
        inventory_item_id: 'item-123',
        quantity: 10,
        par_level: 5,
        unit_cost: 3.50,
        cost_currency: 'GBP',
      },
      error: null,
    })

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') return profileQuery
      if (table === 'store_users') return storeUsersQuery
      if (table === 'store_inventory') return updateQuery
      return updateQuery
    })

    const { PATCH } = await import('@/app/api/stores/[storeId]/inventory/[itemId]/route')

    const request = createMockRequest({ unit_cost: 3.50 })
    const response = await PATCH(request, {
      params: Promise.resolve({ storeId: 'store-1', itemId: 'item-123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.unit_cost).toBe(3.50)
    expect(data.data.cost_currency).toBe('GBP')
  })

  it('should create store_inventory record when none exists (upsert)', async () => {
    const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

    // First call: update fails with PGRST116 (no rows)
    // Second call: insert succeeds
    let storeInventoryCallCount = 0
    const storeInventoryMock = {
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        storeInventoryCallCount++
        if (storeInventoryCallCount === 1) {
          // Update fails — no record exists
          return Promise.resolve({
            data: null,
            error: { code: 'PGRST116', message: 'No rows found' },
          })
        }
        // Insert succeeds
        return Promise.resolve({
          data: {
            store_id: 'store-1',
            inventory_item_id: 'item-123',
            quantity: 0,
            par_level: null,
            unit_cost: 5.50,
            cost_currency: 'GBP',
          },
          error: null,
        })
      }),
    }

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') return profileQuery
      if (table === 'store_users') return storeUsersQuery
      if (table === 'store_inventory') return storeInventoryMock
      return storeInventoryMock
    })

    const { PATCH } = await import('@/app/api/stores/[storeId]/inventory/[itemId]/route')

    const request = createMockRequest({ unit_cost: 5.50 })
    const response = await PATCH(request, {
      params: Promise.resolve({ storeId: 'store-1', itemId: 'item-123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.unit_cost).toBe(5.50)
    expect(data.data.quantity).toBe(0) // New record starts with 0 quantity
  })

  it('should return 400 for negative cost', async () => {
    const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') return profileQuery
      if (table === 'store_users') return storeUsersQuery
      return createChainableMock()
    })

    const { PATCH } = await import('@/app/api/stores/[storeId]/inventory/[itemId]/route')

    const request = createMockRequest({ unit_cost: -1 })
    const response = await PATCH(request, {
      params: Promise.resolve({ storeId: 'store-1', itemId: 'item-123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('BAD_REQUEST')
  })

  it('should return 400 for missing unit_cost', async () => {
    const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') return profileQuery
      if (table === 'store_users') return storeUsersQuery
      return createChainableMock()
    })

    const { PATCH } = await import('@/app/api/stores/[storeId]/inventory/[itemId]/route')

    const request = createMockRequest({})
    const response = await PATCH(request, {
      params: Promise.resolve({ storeId: 'store-1', itemId: 'item-123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('BAD_REQUEST')
  })

  it('should return 403 for Staff users', async () => {
    const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') return profileQuery
      if (table === 'store_users') return storeUsersQuery
      return createChainableMock()
    })

    const { PATCH } = await import('@/app/api/stores/[storeId]/inventory/[itemId]/route')

    const request = createMockRequest({ unit_cost: 5.00 })
    const response = await PATCH(request, {
      params: Promise.resolve({ storeId: 'store-1', itemId: 'item-123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.code).toBe('FORBIDDEN')
  })

  it('should update par_level', async () => {
    const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

    const updateQuery = createChainableMock({
      data: {
        store_id: 'store-1',
        inventory_item_id: 'item-123',
        quantity: 10,
        par_level: 20,
        unit_cost: 3.50,
        cost_currency: 'GBP',
      },
      error: null,
    })

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') return profileQuery
      if (table === 'store_users') return storeUsersQuery
      if (table === 'store_inventory') return updateQuery
      return updateQuery
    })

    const { PATCH } = await import('@/app/api/stores/[storeId]/inventory/[itemId]/route')

    const request = createMockRequest({ par_level: 20 })
    const response = await PATCH(request, {
      params: Promise.resolve({ storeId: 'store-1', itemId: 'item-123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.par_level).toBe(20)
  })

  it('should update par_level to null (clear)', async () => {
    const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

    const updateQuery = createChainableMock({
      data: {
        store_id: 'store-1',
        inventory_item_id: 'item-123',
        quantity: 10,
        par_level: null,
        unit_cost: 3.50,
        cost_currency: 'GBP',
      },
      error: null,
    })

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') return profileQuery
      if (table === 'store_users') return storeUsersQuery
      if (table === 'store_inventory') return updateQuery
      return updateQuery
    })

    const { PATCH } = await import('@/app/api/stores/[storeId]/inventory/[itemId]/route')

    const request = createMockRequest({ par_level: null })
    const response = await PATCH(request, {
      params: Promise.resolve({ storeId: 'store-1', itemId: 'item-123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.par_level).toBeNull()
  })

  it('should update both cost and par_level together', async () => {
    const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

    const updateQuery = createChainableMock({
      data: {
        store_id: 'store-1',
        inventory_item_id: 'item-123',
        quantity: 10,
        par_level: 15,
        unit_cost: 4.00,
        cost_currency: 'GBP',
      },
      error: null,
    })

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') return profileQuery
      if (table === 'store_users') return storeUsersQuery
      if (table === 'store_inventory') return updateQuery
      return updateQuery
    })

    const { PATCH } = await import('@/app/api/stores/[storeId]/inventory/[itemId]/route')

    const request = createMockRequest({ unit_cost: 4.00, par_level: 15 })
    const response = await PATCH(request, {
      params: Promise.resolve({ storeId: 'store-1', itemId: 'item-123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.unit_cost).toBe(4.00)
    expect(data.data.par_level).toBe(15)
  })

  it('should return 400 for negative par_level', async () => {
    const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') return profileQuery
      if (table === 'store_users') return storeUsersQuery
      return createChainableMock()
    })

    const { PATCH } = await import('@/app/api/stores/[storeId]/inventory/[itemId]/route')

    const request = createMockRequest({ par_level: -5 })
    const response = await PATCH(request, {
      params: Promise.resolve({ storeId: 'store-1', itemId: 'item-123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('BAD_REQUEST')
  })

  it('should update quantity', async () => {
    const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

    const updateQuery = createChainableMock({
      data: {
        store_id: 'store-1',
        inventory_item_id: 'item-123',
        quantity: 25,
        par_level: 10,
        unit_cost: 3.50,
        cost_currency: 'GBP',
      },
      error: null,
    })

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') return profileQuery
      if (table === 'store_users') return storeUsersQuery
      if (table === 'store_inventory') return updateQuery
      return updateQuery
    })

    const { PATCH } = await import('@/app/api/stores/[storeId]/inventory/[itemId]/route')

    const request = createMockRequest({ quantity: 25 })
    const response = await PATCH(request, {
      params: Promise.resolve({ storeId: 'store-1', itemId: 'item-123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.quantity).toBe(25)
  })

  it('should accept zero cost', async () => {
    const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

    const updateQuery = createChainableMock({
      data: {
        store_id: 'store-1',
        inventory_item_id: 'item-123',
        quantity: 10,
        unit_cost: 0,
        cost_currency: 'GBP',
      },
      error: null,
    })

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') return profileQuery
      if (table === 'store_users') return storeUsersQuery
      if (table === 'store_inventory') return updateQuery
      return updateQuery
    })

    const { PATCH } = await import('@/app/api/stores/[storeId]/inventory/[itemId]/route')

    const request = createMockRequest({ unit_cost: 0 })
    const response = await PATCH(request, {
      params: Promise.resolve({ storeId: 'store-1', itemId: 'item-123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.unit_cost).toBe(0)
  })
})

describe('DELETE /api/stores/:storeId/inventory/:itemId - Delete Item', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createDeleteRequest(): NextRequest {
    const url = new URL('http://localhost:3000/api/stores/store-1/inventory/item-123')
    return {
      method: 'DELETE',
      nextUrl: url,
      url: url.toString(),
      json: vi.fn(() => Promise.resolve({})),
      headers: new Headers({ 'Content-Type': 'application/json' }),
      cookies: {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
      },
    } as unknown as NextRequest
  }

  it('should clean up operational data and soft-delete item, preserving history', async () => {
    const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') return profileQuery
      if (table === 'store_users') return storeUsersQuery
      return createChainableMock()
    })

    // Admin client: all operations succeed
    const adminMock = createChainableMock({ data: null, error: null })
    mockAdminClient.from.mockReturnValue(adminMock)

    const { DELETE } = await import('@/app/api/stores/[storeId]/inventory/[itemId]/route')

    const request = createDeleteRequest()
    const response = await DELETE(request, {
      params: Promise.resolve({ storeId: 'store-1', itemId: 'item-123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.message).toBe('Item deleted from inventory')

    // Verify operational data cleaned up
    const touchedTables = mockAdminClient.from.mock.calls.map((c: string[]) => c[0])
    expect(touchedTables).toContain('store_inventory')
    expect(touchedTables).toContain('recipe_ingredients')
    // Soft-delete on inventory_items (update, not delete)
    expect(touchedTables).toContain('inventory_items')

    // Verify historical data preserved (NOT deleted)
    expect(touchedTables).not.toContain('stock_history')
    expect(touchedTables).not.toContain('waste_log')
    expect(touchedTables).not.toContain('purchase_order_items')
  })

  it('should return 403 for Staff users', async () => {
    const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') return profileQuery
      if (table === 'store_users') return storeUsersQuery
      return createChainableMock()
    })

    const { DELETE } = await import('@/app/api/stores/[storeId]/inventory/[itemId]/route')

    const request = createDeleteRequest()
    const response = await DELETE(request, {
      params: Promise.resolve({ storeId: 'store-1', itemId: 'item-123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.code).toBe('FORBIDDEN')
  })

  it('should return 403 for users without store access', async () => {
    // User belongs to store-2, not store-1
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    })

    const profileQuery = createChainableMock({
      data: { role: 'Owner', store_id: null, is_platform_admin: false, default_store_id: null },
      error: null,
    })

    const storeUsersQuery = createChainableMock({
      data: [
        {
          id: 'su-1',
          store_id: 'store-2',
          user_id: 'user-123',
          role: 'Owner',
          is_billing_owner: true,
          store: { id: 'store-2', name: 'Other Store', is_active: true },
        },
      ],
      error: null,
    })

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') return profileQuery
      if (table === 'store_users') return storeUsersQuery
      return createChainableMock()
    })

    const { DELETE } = await import('@/app/api/stores/[storeId]/inventory/[itemId]/route')

    const request = createDeleteRequest()
    const response = await DELETE(request, {
      params: Promise.resolve({ storeId: 'store-1', itemId: 'item-123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.code).toBe('FORBIDDEN')
  })
})
