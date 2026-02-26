import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Create chainable query builder mock that is also thenable (like Supabase queries)
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

// Configurable admin client mock for store creation
let mockAdminClientData: { stores?: object; store_users?: object; profiles?: object } = {}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      const defaultMock = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockAdminClientData[table as keyof typeof mockAdminClientData] || null, error: null }),
      }
      return defaultMock
    }),
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
    auth: { limit: 10, windowMs: 60000 },
    createUser: { limit: 5, windowMs: 60000 },
    reports: { limit: 20, windowMs: 60000 },
  },
  getRateLimitHeaders: vi.fn(() => ({
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': '99',
    'X-RateLimit-Reset': String(Date.now() + 60000),
  })),
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
  const url = new URL('http://localhost:3000/api/stores')
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

describe('Stores API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminClientData = {}
  })

  describe('GET /api/stores', () => {
    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        })

        const { GET } = await import('@/app/api/stores/route')

        const request = createMockRequest('GET')
        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.success).toBe(false)
        expect(data.code).toBe('UNAUTHORIZED')
      })
    })

    describe('Authorized Requests', () => {
      it('should return stores list for authenticated user', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        const storesQuery = createChainableMock({
          data: [
            { id: 'store-1', name: 'Test Store 1', is_active: true },
            { id: 'store-2', name: 'Test Store 2', is_active: true },
          ],
          count: 2,
          error: null,
        })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'stores') return storesQuery
          return storesQuery
        })

        const { GET } = await import('@/app/api/stores/route')

        const request = createMockRequest('GET')
        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(Array.isArray(data.data)).toBe(true)
      })
    })
  })

  describe('POST /api/stores', () => {
    describe('Authorization', () => {
      it('should return 403 for Staff users', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return profileQuery
        })

        const { POST } = await import('@/app/api/stores/route')

        const request = createMockRequest('POST', {
          name: 'New Store',
          address: '123 Main St',
        })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(403)
        expect(data.success).toBe(false)
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

        const { POST } = await import('@/app/api/stores/route')

        const request = createMockRequest('POST', {
          address: '123 Main St',
        })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.success).toBe(false)
        expect(data.code).toBe('BAD_REQUEST')
      })
    })

    describe('Successful Creation', () => {
      it('should create store for Owner', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        // Set up admin client to return created store data
        mockAdminClientData = {
          stores: {
            id: 'new-store-123',
            name: 'New Store',
            address: '123 Main St',
            is_active: true,
            created_at: new Date().toISOString(),
          },
        }

        const storesQuery = createChainableMock()
        storesQuery.single = vi.fn().mockResolvedValue({
          data: mockAdminClientData.stores,
          error: null,
        })

        // Create a combined mock that handles both SELECT and INSERT for store_users
        // The key is ensuring the mock is properly thenable for SELECT queries
        const storeUsersCombinedMock = createChainableMock({
          data: [
            {
              id: 'su-1',
              store_id: 'store-1',
              user_id: 'user-123',
              role: 'Owner',
              is_billing_owner: true,
              store: { id: 'store-1', name: 'Test Store', is_active: true },
            },
          ],
          error: null,
        })
        // Add insert capability that returns a chainable mock for the insert operation
        storeUsersCombinedMock.insert = vi.fn(() => {
          const insertMock = createChainableMock({ data: { id: 'su-new' }, error: null })
          return insertMock
        })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersCombinedMock
          if (table === 'stores') return storesQuery
          return storesQuery
        })

        const { POST } = await import('@/app/api/stores/route')

        const request = createMockRequest('POST', {
          name: 'New Store',
          address: '123 Main St',
          is_active: true,
          weekly_hours: null,
        })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(201)
        expect(data.success).toBe(true)
        expect(data.data.name).toBe('New Store')
      })
    })
  })
})
