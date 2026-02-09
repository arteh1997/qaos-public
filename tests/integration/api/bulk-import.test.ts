import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Valid UUIDs for testing (RFC 4122 compliant - version 4, variant a)
const STORE_UUID = '11111111-1111-4111-a111-111111111111'

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
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    single: vi.fn(),
  })),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}))

// Mock admin client
const mockAdminClient = {
  auth: {
    admin: {
      listUsers: vi.fn(),
    },
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    single: vi.fn(),
  })),
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}))

// Mock email
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(() => Promise.resolve({ success: true })),
  getInviteEmailHtml: vi.fn(() => '<html>Invite Email</html>'),
}))

// Mock audit log
vi.mock('@/lib/audit', () => ({
  auditLog: vi.fn(() => Promise.resolve()),
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
    createUser: { limit: 10, windowMs: 60000 },
  },
  getRateLimitHeaders: vi.fn(() => ({})),
}))

// Helper to create mock NextRequest
function createMockRequest(body: object): NextRequest {
  const url = new URL('http://localhost:3000/api/users/bulk-import')

  return {
    method: 'POST',
    nextUrl: url,
    url: url.toString(),
    json: vi.fn(() => Promise.resolve(body)),
    headers: new Headers(),
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

describe('Bulk Import API Tests', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  describe('POST /api/users/bulk-import', () => {
    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        })

        const { POST } = await import('@/app/api/users/bulk-import/route')

        const request = createMockRequest({
          users: [{ email: 'test@example.com', role: 'Staff' }],
          defaultStoreId: STORE_UUID,
        })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(401)
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

        const { POST } = await import('@/app/api/users/bulk-import/route')

        const request = createMockRequest({
          users: [{ email: 'test@example.com', role: 'Staff' }],
          defaultStoreId: STORE_UUID,
        })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(403)
        expect(data.code).toBe('FORBIDDEN')
      })

      it('should return 403 for Manager users', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Manager')

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return profileQuery
        })

        const { POST } = await import('@/app/api/users/bulk-import/route')

        const request = createMockRequest({
          users: [{ email: 'test@example.com', role: 'Staff' }],
          defaultStoreId: STORE_UUID,
        })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(403)
        expect(data.code).toBe('FORBIDDEN')
      })

      it('should return 403 for Driver users', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Driver')

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return profileQuery
        })

        const { POST } = await import('@/app/api/users/bulk-import/route')

        const request = createMockRequest({
          users: [{ email: 'test@example.com', role: 'Staff' }],
          defaultStoreId: STORE_UUID,
        })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(403)
        expect(data.code).toBe('FORBIDDEN')
      })
    })

    describe('Validation', () => {
      it('should return 400 for missing users array', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return profileQuery
        })

        const { POST } = await import('@/app/api/users/bulk-import/route')

        const request = createMockRequest({})
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.code).toBe('BAD_REQUEST')
      })

      it('should return 400 for invalid email', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return profileQuery
        })

        const { POST } = await import('@/app/api/users/bulk-import/route')

        const request = createMockRequest({
          users: [{ email: 'invalid-email', role: 'Staff' }],
          defaultStoreId: STORE_UUID,
        })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.code).toBe('BAD_REQUEST')
      })

      it('should return 400 for invalid role', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return profileQuery
        })

        const { POST } = await import('@/app/api/users/bulk-import/route')

        const request = createMockRequest({
          users: [{ email: 'test@example.com', role: 'InvalidRole' }],
          defaultStoreId: STORE_UUID,
        })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.code).toBe('BAD_REQUEST')
      })
    })

    describe('Successful Import', () => {
      it('should successfully import users for Owner', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        // Setup admin client mocks
        mockAdminClient.auth.admin.listUsers.mockResolvedValue({
          data: { users: [] },
          error: null,
        })

        const adminInviterProfileQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { full_name: 'Owner User', email: 'owner@example.com' },
            error: null,
          }),
        }

        const adminStoreUsersQuery = createChainableMock({
          data: [{ role: 'Owner' }],
          error: null,
        })

        const adminExistingInvitesQuery = createChainableMock({
          data: [],
          error: null,
        })

        const adminStoresQuery = createChainableMock({
          data: [{ id: STORE_UUID, name: 'Test Store' }],
          error: null,
        })

        const adminInviteInsertQuery = createChainableMock({ error: null })
        adminInviteInsertQuery.insert = vi.fn().mockResolvedValue({ error: null })
        adminInviteInsertQuery.delete = vi.fn().mockReturnThis()

        mockAdminClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return adminInviterProfileQuery
          if (table === 'store_users') return adminStoreUsersQuery
          if (table === 'user_invites') return adminInviteInsertQuery
          if (table === 'stores') return adminStoresQuery
          return adminInviterProfileQuery
        })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return profileQuery
        })

        const { POST } = await import('@/app/api/users/bulk-import/route')

        const request = createMockRequest({
          users: [
            { email: 'newuser@example.com', role: 'Staff' },
          ],
          defaultStoreId: STORE_UUID,
        })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(201)
        expect(data.success).toBe(true)
        expect(data.data.summary).toBeDefined()
      })

      it('should skip existing users', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        // Setup admin client with existing user
        mockAdminClient.auth.admin.listUsers.mockResolvedValue({
          data: { users: [{ email: 'existing@example.com' }] },
          error: null,
        })

        const adminProfileQuery = createChainableMock({
          data: { full_name: 'Owner User', email: 'owner@example.com' },
          error: null,
        })

        const adminStoreUsersQuery = createChainableMock({
          data: [{ role: 'Owner' }],
          error: null,
        })

        const adminInvitesQuery = createChainableMock({
          data: [],
          error: null,
        })

        const adminStoresQuery = createChainableMock({
          data: [{ id: STORE_UUID, name: 'Test Store' }],
          error: null,
        })

        mockAdminClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return adminProfileQuery
          if (table === 'store_users') return adminStoreUsersQuery
          if (table === 'user_invites') return adminInvitesQuery
          if (table === 'stores') return adminStoresQuery
          return adminProfileQuery
        })

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          return profileQuery
        })

        const { POST } = await import('@/app/api/users/bulk-import/route')

        const request = createMockRequest({
          users: [
            { email: 'existing@example.com', role: 'Staff' },
          ],
          defaultStoreId: STORE_UUID,
        })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(201)
        expect(data.data.summary.skipped).toBe(1)
      })
    })
  })
})
