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

// Mock admin client for webhook tests
const mockAdminClient = {
  from: vi.fn(),
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
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

// Mock CSRF validation
vi.mock('@/lib/csrf', () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
  getCSRFToken: vi.fn().mockResolvedValue('test-csrf-token'),
}))

// Mock POS service for webhook tests
vi.mock('@/lib/services/pos', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/pos')>()
  return {
    ...actual,
    processSaleEvent: vi.fn(),
  }
})

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
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    },
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

describe('POS API Integration Tests', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  // ─── POS Connection Management Routes ─────────────────────────────

  describe('GET /api/stores/[storeId]/pos', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const { GET } = await import('@/app/api/stores/[storeId]/pos/route')

      const request = createMockRequest('GET', '/api/stores/store-123/pos')
      const response = await GET(request, { params: Promise.resolve({ storeId: 'store-123' }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.code).toBe('UNAUTHORIZED')
    })

    it('should return POS connections for Owner', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

      const posConnectionsQuery = createChainableMock({
        data: [
          {
            id: 'conn-1',
            provider: 'square',
            name: 'Main Square POS',
            is_active: true,
            last_synced_at: '2026-02-10T12:00:00Z',
            sync_status: 'synced',
            sync_error: null,
            created_at: '2026-01-01T00:00:00Z',
          },
          {
            id: 'conn-2',
            provider: 'toast',
            name: 'Toast Bar POS',
            is_active: true,
            last_synced_at: null,
            sync_status: 'pending',
            sync_error: null,
            created_at: '2026-02-01T00:00:00Z',
          },
        ],
        error: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'pos_connections') return posConnectionsQuery
        return posConnectionsQuery
      })

      const { GET } = await import('@/app/api/stores/[storeId]/pos/route')

      const request = createMockRequest('GET', '/api/stores/store-123/pos')
      const response = await GET(request, { params: Promise.resolve({ storeId: 'store-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(Array.isArray(data.data)).toBe(true)
      expect(data.data).toHaveLength(2)
      expect(data.data[0].provider).toBe('square')
      expect(data.data[1].provider).toBe('toast')
    })
  })

  describe('POST /api/stores/[storeId]/pos', () => {
    it('should create a POS connection for Owner', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

      const insertResult = createChainableMock({
        data: {
          id: 'conn-new',
          provider: 'square',
          name: 'New Square POS',
          is_active: true,
          sync_status: 'pending',
          created_at: '2026-02-10T14:00:00Z',
        },
        error: null,
      })

      // The audit_logs mock needs to be chainable too
      const auditQuery = createChainableMock({ error: null })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'pos_connections') return insertResult
        if (table === 'audit_logs') return auditQuery
        return auditQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/pos/route')

      const request = createMockRequest('POST', '/api/stores/store-123/pos', {
        provider: 'square',
        name: 'New Square POS',
        credentials: { api_key: 'test-key' },
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: 'store-123' }) })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.provider).toBe('square')
      expect(data.data.name).toBe('New Square POS')
    })

    it('should return 400 for invalid provider', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/pos/route')

      const request = createMockRequest('POST', '/api/stores/store-123/pos', {
        provider: 'invalid_pos_system',
        name: 'Bad POS',
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: 'store-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('BAD_REQUEST')
    })

    it('should return 400 for missing name', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/pos/route')

      const request = createMockRequest('POST', '/api/stores/store-123/pos', {
        provider: 'square',
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: 'store-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('BAD_REQUEST')
    })

    it('should return 403 for Staff', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/pos/route')

      const request = createMockRequest('POST', '/api/stores/store-123/pos', {
        provider: 'square',
        name: 'Unauthorized POS',
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: 'store-123' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.code).toBe('FORBIDDEN')
    })
  })

  describe('DELETE /api/stores/[storeId]/pos', () => {
    it('should delete a POS connection', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

      const deleteQuery = createChainableMock({ data: null, error: null })
      const auditQuery = createChainableMock({ error: null })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'pos_connections') return deleteQuery
        if (table === 'audit_logs') return auditQuery
        return auditQuery
      })

      const { DELETE } = await import('@/app/api/stores/[storeId]/pos/route')

      const request = createMockRequest(
        'DELETE',
        '/api/stores/store-123/pos',
        undefined,
        { connectionId: 'conn-1' }
      )
      const response = await DELETE(request, { params: Promise.resolve({ storeId: 'store-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.deleted).toBe(true)
    })

    it('should return 400 without connectionId', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const { DELETE } = await import('@/app/api/stores/[storeId]/pos/route')

      const request = createMockRequest('DELETE', '/api/stores/store-123/pos')
      const response = await DELETE(request, { params: Promise.resolve({ storeId: 'store-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('BAD_REQUEST')
    })
  })

  // ─── POS Webhook Receiver Route ────────────────────────────────────

  describe('POST /api/pos/webhook/[connectionId]', () => {
    it('should return 404 for invalid connection', async () => {
      mockAdminClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        }),
      }))

      const { POST } = await import('@/app/api/pos/webhook/[connectionId]/route')

      const request = createMockRequest('POST', '/api/pos/webhook/bad-conn-id', {
        event_id: 'evt-1',
        items: [{ pos_item_id: 'item-1', pos_item_name: 'Burger', quantity: 1 }],
      })
      const response = await POST(request, { params: Promise.resolve({ connectionId: 'bad-conn-id' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid connection')
    })

    it('should return 400 for missing event_id', async () => {
      mockAdminClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'conn-1',
            store_id: 'store-123',
            provider: 'square',
            is_active: true,
            credentials: {},
          },
          error: null,
        }),
      }))

      const { POST } = await import('@/app/api/pos/webhook/[connectionId]/route')

      const request = createMockRequest('POST', '/api/pos/webhook/conn-1', {
        items: [{ pos_item_id: 'item-1', pos_item_name: 'Burger', quantity: 1 }],
      })
      const response = await POST(request, { params: Promise.resolve({ connectionId: 'conn-1' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('event_id is required')
    })

    it('should return 400 for missing items', async () => {
      mockAdminClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'conn-1',
            store_id: 'store-123',
            provider: 'square',
            is_active: true,
            credentials: {},
          },
          error: null,
        }),
      }))

      const { POST } = await import('@/app/api/pos/webhook/[connectionId]/route')

      const request = createMockRequest('POST', '/api/pos/webhook/conn-1', {
        event_id: 'evt-1',
      })
      const response = await POST(request, { params: Promise.resolve({ connectionId: 'conn-1' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('items array is required and must not be empty')
    })

    it('should process a sale event', async () => {
      mockAdminClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'conn-1',
            store_id: 'store-123',
            provider: 'square',
            is_active: true,
            credentials: {},
          },
          error: null,
        }),
      }))

      const { processSaleEvent } = await import('@/lib/services/pos')
      vi.mocked(processSaleEvent).mockResolvedValue({
        event_id: 'event-1',
        status: 'processed',
        items_deducted: 2,
        items_skipped: 0,
      })

      const { POST } = await import('@/app/api/pos/webhook/[connectionId]/route')

      const request = createMockRequest('POST', '/api/pos/webhook/conn-1', {
        event_id: 'pos-evt-123',
        event_type: 'sale',
        items: [
          { pos_item_id: 'burger-1', pos_item_name: 'Classic Burger', quantity: 2, unit_price: 12.99 },
          { pos_item_id: 'fries-1', pos_item_name: 'Large Fries', quantity: 1, unit_price: 4.99 },
        ],
        total_amount: 30.97,
        currency: 'USD',
        occurred_at: '2026-02-10T14:30:00Z',
      })
      const response = await POST(request, { params: Promise.resolve({ connectionId: 'conn-1' }) })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('processed')
      expect(data.data.items_deducted).toBe(2)
      expect(processSaleEvent).toHaveBeenCalledWith(
        'conn-1',
        'store-123',
        expect.objectContaining({
          external_event_id: 'pos-evt-123',
          event_type: 'sale',
        })
      )
    })
  })
})
