import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

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

const mockSupabaseClient = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: vi.fn(() => createChainableMock({ error: null })) })),
}))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ success: true, remaining: 99, resetTime: Date.now() + 60000, limit: 100 })),
  RATE_LIMITS: { api: { limit: 100, windowMs: 60000 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}))
vi.mock('@/lib/audit', () => ({ auditLog: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/csrf', () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
  getCSRFToken: vi.fn().mockResolvedValue('test-csrf-token'),
}))

function createMockRequest(method: string, path: string, body?: object, searchParams?: Record<string, string>): NextRequest {
  const url = new URL(`http://localhost:3000${path}`)
  if (searchParams) Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v))
  return {
    method, nextUrl: url, url: url.toString(),
    json: vi.fn(() => Promise.resolve(body || {})),
    headers: new Headers(),
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  } as unknown as NextRequest
}

function setupAuthenticatedUser(role: string, storeId: string) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-123', email: 'test@example.com' } }, error: null,
  })
  const profileQuery = createChainableMock({
    data: { id: 'user-123', role, store_id: null, is_platform_admin: false, default_store_id: null }, error: null,
  })
  const storeUsersQuery = createChainableMock({
    data: [{ id: 'su-1', store_id: storeId, user_id: 'user-123', role, is_billing_owner: role === 'Owner', store: { id: storeId, name: 'Test Store', is_active: true } }],
    error: null,
  })
  return { profileQuery, storeUsersQuery }
}

describe('Suppliers API', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  const STORE_UUID = '11111111-1111-4111-a111-111111111111'
  const SUPPLIER_UUID = '22222222-2222-4222-a222-222222222222'

  describe('GET /api/stores/[storeId]/suppliers', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
      const { GET } = await import('@/app/api/stores/[storeId]/suppliers/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/suppliers`)
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      expect(response.status).toBe(401)
    })

    it('should return suppliers for Owner', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const suppliersQuery = createChainableMock({
        data: [
          { id: SUPPLIER_UUID, store_id: STORE_UUID, name: 'Fresh Foods Co', is_active: true },
        ],
        error: null,
        count: 1,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'suppliers') return suppliersQuery
        return storeUsersQuery
      })

      const { GET } = await import('@/app/api/stores/[storeId]/suppliers/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/suppliers`)
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].name).toBe('Fresh Foods Co')
    })

    it('should return 403 for Staff', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff', STORE_UUID)
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })
      const { GET } = await import('@/app/api/stores/[storeId]/suppliers/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/suppliers`)
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      expect(response.status).toBe(403)
    })
  })

  describe('POST /api/stores/[storeId]/suppliers', () => {
    it('should create supplier for Owner', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)
      const insertQuery = createChainableMock({
        data: { id: SUPPLIER_UUID, store_id: STORE_UUID, name: 'New Supplier', is_active: true },
        error: null,
      })
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'suppliers') return insertQuery
        return storeUsersQuery
      })
      const { POST } = await import('@/app/api/stores/[storeId]/suppliers/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/suppliers`, {
        name: 'New Supplier',
        email: 'new@supplier.com',
        phone: '555-1234',
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()
      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('New Supplier')
    })

    it('should return 403 for Driver', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Driver', STORE_UUID)
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })
      const { POST } = await import('@/app/api/stores/[storeId]/suppliers/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/suppliers`, { name: 'Test' })
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      expect(response.status).toBe(403)
    })

    it('should return 400 for missing name', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      const { POST } = await import('@/app/api/stores/[storeId]/suppliers/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/suppliers`, {})
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      expect(response.status).toBe(400)
    })
  })
})
