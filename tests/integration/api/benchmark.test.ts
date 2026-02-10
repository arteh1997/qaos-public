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
  RATE_LIMITS: { reports: { limit: 100, windowMs: 60000 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}))
vi.mock('@/lib/audit', () => ({ auditLog: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/csrf', () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
  getCSRFToken: vi.fn().mockResolvedValue('test-csrf-token'),
}))

function createMockRequest(method: string, path: string, searchParams?: Record<string, string>): NextRequest {
  const url = new URL(`http://localhost:3000${path}`)
  if (searchParams) Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v))
  return {
    method,
    nextUrl: url,
    url: url.toString(),
    json: vi.fn(() => Promise.resolve({})),
    headers: new Headers(),
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  } as unknown as NextRequest
}

const STORE_A = '11111111-1111-4111-a111-111111111111'
const STORE_B = '22222222-2222-4222-a222-222222222222'

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
      { id: 'su-1', store_id: STORE_A, user_id: 'user-123', role: 'Owner', is_billing_owner: true, store: { id: STORE_A, name: 'Store Alpha', is_active: true } },
      { id: 'su-2', store_id: STORE_B, user_id: 'user-123', role: 'Owner', is_billing_owner: true, store: { id: STORE_B, name: 'Store Beta', is_active: true } },
    ],
    error: null,
  })
  return { profileQuery, storeUsersQuery }
}

describe('Benchmark API', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  describe('GET /api/reports/benchmark', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
      const { GET } = await import('@/app/api/reports/benchmark/route')
      const request = createMockRequest('GET', '/api/reports/benchmark', {
        store_ids: `${STORE_A},${STORE_B}`,
      })
      const response = await GET(request)
      expect(response.status).toBe(401)
    })

    it('should return 400 when store_ids missing', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner()
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const { GET } = await import('@/app/api/reports/benchmark/route')
      const request = createMockRequest('GET', '/api/reports/benchmark')
      const response = await GET(request)
      expect(response.status).toBe(400)
    })

    it('should return benchmark data for Owner with multiple stores', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner()

      const storesQuery = createChainableMock({
        data: [
          { id: STORE_A, name: 'Store Alpha' },
          { id: STORE_B, name: 'Store Beta' },
        ],
        error: null,
      })

      const stockHistoryQuery = createChainableMock({
        data: [
          { store_id: STORE_A, action_type: 'Count', quantity_change: 5, created_at: new Date().toISOString() },
          { store_id: STORE_A, action_type: 'Reception', quantity_change: 10, created_at: new Date().toISOString() },
          { store_id: STORE_B, action_type: 'Count', quantity_change: 3, created_at: new Date().toISOString() },
        ],
        error: null,
      })

      const inventoryQuery = createChainableMock({
        data: [
          { store_id: STORE_A, quantity: 50, par_level: 20, unit_cost: 5 },
          { store_id: STORE_A, quantity: 0, par_level: 10, unit_cost: 3 },
          { store_id: STORE_B, quantity: 30, par_level: 15, unit_cost: 4 },
        ],
        error: null,
      })

      const dailyCountsQuery = createChainableMock({
        data: [
          { store_id: STORE_A, count_date: '2026-02-10' },
          { store_id: STORE_A, count_date: '2026-02-09' },
          { store_id: STORE_B, count_date: '2026-02-10' },
        ],
        error: null,
      })

      const wasteQuery = createChainableMock({
        data: [
          { store_id: STORE_A, quantity_change: -5, created_at: new Date().toISOString() },
        ],
        error: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'stores') return storesQuery
        if (table === 'stock_history') {
          // First call is for all history, second for waste
          return stockHistoryQuery
        }
        if (table === 'store_inventory') return inventoryQuery
        if (table === 'daily_counts') return dailyCountsQuery
        return storeUsersQuery
      })

      const { GET } = await import('@/app/api/reports/benchmark/route')
      const request = createMockRequest('GET', '/api/reports/benchmark', {
        store_ids: `${STORE_A},${STORE_B}`,
        days: '30',
      })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.stores).toHaveLength(2)
      expect(data.data.stores[0].storeId).toBe(STORE_A)
      expect(data.data.stores[1].storeId).toBe(STORE_B)
      expect(data.data.rankings).toBeDefined()
      expect(data.data.rankings.healthScore).toHaveLength(2)
      expect(data.data.averages).toBeDefined()
      expect(data.data.period).toBeDefined()
    })

    it('should return 403 for Staff role', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-456', email: 'staff@example.com' } }, error: null,
      })
      const profileQuery = createChainableMock({
        data: { id: 'user-456', role: 'Staff', store_id: STORE_A, is_platform_admin: false, default_store_id: null },
        error: null,
      })
      const storeUsersQuery = createChainableMock({
        data: [
          { id: 'su-3', store_id: STORE_A, user_id: 'user-456', role: 'Staff', is_billing_owner: false, store: { id: STORE_A, name: 'Store Alpha', is_active: true } },
        ],
        error: null,
      })
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const { GET } = await import('@/app/api/reports/benchmark/route')
      const request = createMockRequest('GET', '/api/reports/benchmark', {
        store_ids: `${STORE_A},${STORE_B}`,
      })
      const response = await GET(request)
      expect(response.status).toBe(403)
    })

    it('should respect max 10 stores limit', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner()
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const ids = Array.from({ length: 11 }, (_, i) =>
        `${String(i).padStart(8, '0')}-0000-4000-a000-000000000000`
      )

      const { GET } = await import('@/app/api/reports/benchmark/route')
      const request = createMockRequest('GET', '/api/reports/benchmark', {
        store_ids: ids.join(','),
      })
      const response = await GET(request)
      expect(response.status).toBe(400)
    })

    it('should cap days at 90', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner()

      const storesQuery = createChainableMock({ data: [{ id: STORE_A, name: 'A' }], error: null })
      const emptyQuery = createChainableMock({ data: [], error: null })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'stores') return storesQuery
        return emptyQuery
      })

      const { GET } = await import('@/app/api/reports/benchmark/route')
      const request = createMockRequest('GET', '/api/reports/benchmark', {
        store_ids: STORE_A,
        days: '180',
      })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.period.days).toBe(90)
    })
  })
})
