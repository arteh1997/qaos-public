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
    method,
    nextUrl: url,
    url: url.toString(),
    json: vi.fn(() => Promise.resolve(body || {})),
    headers: new Headers(),
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  } as unknown as NextRequest
}

const STORE_UUID = '11111111-1111-4111-a111-111111111111'

function setupAuthenticatedOwner() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-123', email: 'owner@example.com' } }, error: null,
  })
  const profileQuery = createChainableMock({
    data: { id: 'user-123', role: 'Owner', store_id: null, is_platform_admin: false, default_store_id: null },
    error: null,
  })
  const storeUsersQuery = createChainableMock({
    data: [
      { id: 'su-1', store_id: STORE_UUID, user_id: 'user-123', role: 'Owner', is_billing_owner: true, store: { id: STORE_UUID, name: 'Test Store', is_active: true } },
    ],
    error: null,
  })
  return { profileQuery, storeUsersQuery }
}

describe('Webhook Management', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  describe('GET /api/stores/[storeId]/webhooks', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
      const { GET } = await import('@/app/api/stores/[storeId]/webhooks/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/webhooks`)
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      expect(response.status).toBe(401)
    })

    it('should return webhook endpoints for Owner', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner()

      const webhooksQuery = createChainableMock({
        data: [
          { id: 'wh-1', url: 'https://example.com/webhook', events: ['stock.counted'], is_active: true, description: 'Stock webhook', created_at: '2026-02-10', updated_at: '2026-02-10' },
        ],
        error: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'webhook_endpoints') return webhooksQuery
        return storeUsersQuery
      })

      const { GET } = await import('@/app/api/stores/[storeId]/webhooks/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/webhooks`)
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].url).toBe('https://example.com/webhook')
    })
  })

  describe('POST /api/stores/[storeId]/webhooks', () => {
    it('should create a webhook endpoint for Owner', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner()

      const insertQuery = createChainableMock({
        data: { id: 'wh-2', url: 'https://example.com/hook', events: ['stock.counted'], is_active: true, description: 'New webhook', created_at: '2026-02-10' },
        error: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'webhook_endpoints') return insertQuery
        if (table === 'audit_logs') return createChainableMock({ error: null })
        return storeUsersQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/webhooks/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/webhooks`, {
        url: 'https://example.com/hook',
        events: ['stock.counted'],
        description: 'New webhook',
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.secret).toMatch(/^whsec_/)
    })

    it('should return 400 for missing url', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner()
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/webhooks/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/webhooks`, {
        events: ['stock.counted'],
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      expect(response.status).toBe(400)
    })

    it('should return 400 for empty events array', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner()
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/webhooks/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/webhooks`, {
        url: 'https://example.com/hook',
        events: [],
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      expect(response.status).toBe(400)
    })

    it('should return 400 for invalid event type', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner()
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/webhooks/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/webhooks`, {
        url: 'https://example.com/hook',
        events: ['nonexistent.event'],
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      expect(response.status).toBe(400)
    })

    it('should return 403 for Staff', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-456', email: 'staff@example.com' } }, error: null,
      })
      const profileQuery = createChainableMock({
        data: { id: 'user-456', role: 'Staff', store_id: STORE_UUID, is_platform_admin: false, default_store_id: null },
        error: null,
      })
      const storeUsersQuery = createChainableMock({
        data: [{ id: 'su-2', store_id: STORE_UUID, user_id: 'user-456', role: 'Staff', is_billing_owner: false, store: { id: STORE_UUID, name: 'Store', is_active: true } }],
        error: null,
      })
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/webhooks/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/webhooks`, {
        url: 'https://example.com/hook',
        events: ['stock.counted'],
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      expect(response.status).toBe(403)
    })
  })

  describe('DELETE /api/stores/[storeId]/webhooks', () => {
    it('should delete a webhook endpoint', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner()

      const deleteQuery = createChainableMock({ data: null, error: null })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'webhook_endpoints') return deleteQuery
        if (table === 'audit_logs') return createChainableMock({ error: null })
        return storeUsersQuery
      })

      const { DELETE } = await import('@/app/api/stores/[storeId]/webhooks/route')
      const request = createMockRequest('DELETE', `/api/stores/${STORE_UUID}/webhooks`, undefined, { webhookId: 'wh-1' })
      const response = await DELETE(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.deleted).toBe(true)
    })

    it('should return 400 without webhookId', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner()
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })

      const { DELETE } = await import('@/app/api/stores/[storeId]/webhooks/route')
      const request = createMockRequest('DELETE', `/api/stores/${STORE_UUID}/webhooks`)
      const response = await DELETE(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      expect(response.status).toBe(400)
    })
  })
})
