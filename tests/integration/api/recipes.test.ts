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
vi.mock('@/lib/audit', () => ({ auditLog: vi.fn().mockResolvedValue(undefined), computeFieldChanges: vi.fn().mockReturnValue([]) }))
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

describe('Recipes API', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  const STORE_UUID = '11111111-1111-4111-a111-111111111111'
  const RECIPE_UUID = '55555555-5555-4555-a555-555555555555'

  describe('GET /api/stores/[storeId]/recipes', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
      const { GET } = await import('@/app/api/stores/[storeId]/recipes/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/recipes`)
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      expect(response.status).toBe(401)
    })

    it('should return recipes for Owner', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const recipesQuery = createChainableMock({
        data: [
          { id: RECIPE_UUID, store_id: STORE_UUID, name: 'Margherita Pizza', yield_quantity: 4, yield_unit: 'serving' },
        ],
        error: null,
        count: 1,
      })

      const ingredientsQuery = createChainableMock({ data: [], error: null })
      const inventoryQuery = createChainableMock({ data: [], error: null })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'recipes') return recipesQuery
        if (table === 'recipe_ingredients') return ingredientsQuery
        if (table === 'store_inventory') return inventoryQuery
        return storeUsersQuery
      })

      const { GET } = await import('@/app/api/stores/[storeId]/recipes/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/recipes`)
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].name).toBe('Margherita Pizza')
      expect(data.data[0].total_cost).toBeDefined()
    })

  })

  describe('POST /api/stores/[storeId]/recipes', () => {
    it('should create recipe for Owner', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)
      const recipeInsertQuery = createChainableMock({
        data: { id: RECIPE_UUID, store_id: STORE_UUID, name: 'Caesar Salad', yield_quantity: 2, yield_unit: 'serving' },
        error: null,
      })
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'recipes') return recipeInsertQuery
        return storeUsersQuery
      })
      const { POST } = await import('@/app/api/stores/[storeId]/recipes/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/recipes`, {
        name: 'Caesar Salad', yield_quantity: 2, yield_unit: 'serving',
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()
      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('Caesar Salad')
    })

    it('should return 403 for Staff', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff', STORE_UUID)
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })
      const { POST } = await import('@/app/api/stores/[storeId]/recipes/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/recipes`, {
        name: 'Test', yield_quantity: 1, yield_unit: 'serving',
      })
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
      const { POST } = await import('@/app/api/stores/[storeId]/recipes/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/recipes`, {
        yield_quantity: 1, yield_unit: 'serving',
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      expect(response.status).toBe(400)
    })
  })
})
