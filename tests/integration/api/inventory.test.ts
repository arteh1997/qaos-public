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

// Mock CSRF validation
vi.mock('@/lib/csrf', () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
  getCSRFToken: vi.fn().mockResolvedValue('test-csrf-token'),
}))

// Helper to create mock NextRequest
function createMockRequest(
  method: string,
  body?: object,
  searchParams?: Record<string, string>
): NextRequest {
  const url = new URL('http://localhost:3000/api/inventory')
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  return {
    method,
    nextUrl: url,
    json: vi.fn(() => Promise.resolve(body || {})),
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
        store_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: 'user-123',
        role,
        is_billing_owner: role === 'Owner',
        store: { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Test Store', is_active: true },
      },
    ],
    error: null,
  })

  return { profileQuery, storeUsersQuery }
}

describe('Inventory API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/inventory', () => {
    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        })

        const { GET } = await import('@/app/api/inventory/route')

        const request = createMockRequest('GET')
        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.success).toBe(false)
        expect(data.code).toBe('UNAUTHORIZED')
      })
    })

    describe('Authorized Requests', () => {
      it('should return inventory items list', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        const inventoryQuery = createChainableMock({
          data: [
            { id: 'item-1', name: 'Tomatoes', category: 'Produce', unit_of_measure: 'kg', is_active: true },
            { id: 'item-2', name: 'Chicken', category: 'Meat', unit_of_measure: 'kg', is_active: true },
          ],
          count: 2,
          error: null,
        })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'inventory_items') return inventoryQuery
          return inventoryQuery
        })

        const { GET } = await import('@/app/api/inventory/route')

        const request = createMockRequest('GET', undefined, { store_id: '550e8400-e29b-41d4-a716-446655440000' })
        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data).toHaveLength(2)
        expect(data.data[0].name).toBe('Tomatoes')
      })

      it('should include pagination metadata', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        const inventoryQuery = createChainableMock({
          data: [
            { id: 'item-1', name: 'Tomatoes', category: 'Produce' },
          ],
          count: 1,
          error: null,
        })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return inventoryQuery
        })

        const { GET } = await import('@/app/api/inventory/route')

        const request = createMockRequest('GET', undefined, { store_id: '550e8400-e29b-41d4-a716-446655440000', page: '1', pageSize: '10' })
        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.pagination).toBeDefined()
      })
    })

    describe('Filtering', () => {
      it('should filter by search term', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        const inventoryQuery = createChainableMock({
          data: [{ id: 'item-1', name: 'Tomatoes', category: 'Produce' }],
          count: 1,
          error: null,
        })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return inventoryQuery
        })

        const { GET } = await import('@/app/api/inventory/route')

        const request = createMockRequest('GET', undefined, { store_id: '550e8400-e29b-41d4-a716-446655440000', search: 'tomato' })
        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.data).toHaveLength(1)
      })

      it('should filter by category', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        const inventoryQuery = createChainableMock({
          data: [{ id: 'item-2', name: 'Chicken', category: 'Meat' }],
          count: 1,
          error: null,
        })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return inventoryQuery
        })

        const { GET } = await import('@/app/api/inventory/route')

        const request = createMockRequest('GET', undefined, { store_id: '550e8400-e29b-41d4-a716-446655440000', category: 'Meat' })
        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.data[0].category).toBe('Meat')
      })
    })
  })

  describe('POST /api/inventory', () => {
    describe('Authorization', () => {
      it('should return 403 for Staff users', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return profileQuery
        })

        const { POST } = await import('@/app/api/inventory/route')

        const request = createMockRequest('POST', {
          name: 'New Item',
          unit_of_measure: 'kg',
          is_active: true,
        })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(403)
        expect(data.success).toBe(false)
        expect(data.code).toBe('FORBIDDEN')
      })

      it('should return 403 for Driver users', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Driver')

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return profileQuery
        })

        const { POST } = await import('@/app/api/inventory/route')

        const request = createMockRequest('POST', {
          name: 'New Item',
          unit_of_measure: 'kg',
          is_active: true,
        })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(403)
        expect(data.code).toBe('FORBIDDEN')
      })
    })

    describe('Validation', () => {
      it('should return 400 for missing name', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return profileQuery
        })

        const { POST } = await import('@/app/api/inventory/route')

        const request = createMockRequest('POST', {
          unit_of_measure: 'kg',
          is_active: true,
        })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.success).toBe(false)
        expect(data.code).toBe('BAD_REQUEST')
      })

      it('should return 400 for missing unit_of_measure', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return profileQuery
        })

        const { POST } = await import('@/app/api/inventory/route')

        const request = createMockRequest('POST', {
          name: 'Valid Name',
          is_active: true,
        })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.code).toBe('BAD_REQUEST')
      })
    })

    describe('Duplicate Detection', () => {
      it('should return 400 if item name already exists', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        // Mock existing item found
        const inventoryQuery = createChainableMock({
          data: { id: 'existing-item' },
          error: null,
        })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'inventory_items') return inventoryQuery
          return inventoryQuery
        })

        const { POST } = await import('@/app/api/inventory/route')

        const request = createMockRequest('POST', {
          store_id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Existing Item',
          unit_of_measure: 'kg',
          is_active: true,
        })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.message).toContain('already exists')
      })
    })

    describe('Successful Creation', () => {
      it('should create inventory item for Owner', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        // First call returns null (no existing), second returns created item
        let callCount = 0
        const inventoryQuery = createChainableMock()
        inventoryQuery.single = vi.fn().mockImplementation(() => {
          callCount++
          if (callCount === 1) {
            // First call: check for existing
            return Promise.resolve({ data: null, error: { code: 'PGRST116' } })
          }
          // Second call: insert result
          return Promise.resolve({
            data: {
              id: 'new-item-123',
              name: 'New Ingredient',
              category: 'Produce',
              unit_of_measure: 'kg',
              is_active: true,
              created_at: new Date().toISOString(),
            },
            error: null,
          })
        })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'inventory_items') return inventoryQuery
          return inventoryQuery
        })

        const { POST } = await import('@/app/api/inventory/route')

        const request = createMockRequest('POST', {
          store_id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'New Ingredient',
          category: 'Produce',
          unit_of_measure: 'kg',
          is_active: true,
        })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(201)
        expect(data.success).toBe(true)
        expect(data.data.name).toBe('New Ingredient')
      })

      it('should create inventory item for Manager', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Manager')

        let callCount = 0
        const inventoryQuery = createChainableMock()
        inventoryQuery.single = vi.fn().mockImplementation(() => {
          callCount++
          if (callCount === 1) {
            return Promise.resolve({ data: null, error: { code: 'PGRST116' } })
          }
          return Promise.resolve({
            data: {
              id: 'new-item-456',
              name: 'Manager Created Item',
              unit_of_measure: 'units',
              is_active: true,
            },
            error: null,
          })
        })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return inventoryQuery
        })

        const { POST } = await import('@/app/api/inventory/route')

        const request = createMockRequest('POST', {
          store_id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Manager Created Item',
          unit_of_measure: 'units',
          is_active: true,
        })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(201)
        expect(data.success).toBe(true)
      })
    })
  })
})
