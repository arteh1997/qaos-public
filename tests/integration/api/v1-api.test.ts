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

const STORE_UUID = '11111111-1111-4111-a111-111111111111'
const KEY_ID = 'apikey-001'

vi.mock('@/lib/api/api-keys', () => ({
  validateApiKey: vi.fn(),
  hasScope: vi.fn((scopes: string[], required: string) => {
    if (scopes.includes('*')) return true
    if (scopes.includes(required)) return true
    const [category] = required.split(':')
    if (scopes.includes(`${category}:*`)) return true
    return false
  }),
  generateWebhookSecret: vi.fn(() => 'whsec_test'),
}))

let mockAdminFrom: ReturnType<typeof vi.fn>
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
  })),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ success: true, remaining: 99, resetTime: Date.now() + 60000, limit: 100 })),
  RATE_LIMITS: { api: { limit: 100, windowMs: 60000 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}))

vi.mock('@/lib/services/webhooks', () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue(undefined),
  WEBHOOK_EVENTS: {
    'inventory.item_created': 'When a new inventory item is added',
    'stock.counted': 'When a stock count is submitted',
    'stock.received': 'When a stock reception is recorded',
  },
}))

function createMockRequest(method: string, path: string, body?: object, searchParams?: Record<string, string>): NextRequest {
  const url = new URL(`http://localhost:3000${path}`)
  if (searchParams) Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v))
  const headers = new Headers()
  return {
    method,
    nextUrl: url,
    url: url.toString(),
    json: vi.fn(() => Promise.resolve(body || {})),
    headers,
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  } as unknown as NextRequest
}

function createAuthenticatedRequest(method: string, path: string, body?: object, searchParams?: Record<string, string>): NextRequest {
  const url = new URL(`http://localhost:3000${path}`)
  if (searchParams) Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v))
  const headers = new Headers({
    'authorization': 'Bearer rk_live_testkey123',
  })
  return {
    method,
    nextUrl: url,
    url: url.toString(),
    json: vi.fn(() => Promise.resolve(body || {})),
    headers,
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  } as unknown as NextRequest
}

describe('Public API v1', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockAdminFrom = vi.fn()
  })

  describe('GET /api/v1/inventory', () => {
    it('should return 401 without API key', async () => {
      const { validateApiKey } = await import('@/lib/api/api-keys')
      vi.mocked(validateApiKey).mockResolvedValue({ valid: false })

      const { GET } = await import('@/app/api/v1/inventory/route')
      const request = createMockRequest('GET', '/api/v1/inventory')
      const response = await GET(request)
      expect(response.status).toBe(401)
    })

    it('should return inventory items with valid key', async () => {
      const { validateApiKey } = await import('@/lib/api/api-keys')
      vi.mocked(validateApiKey).mockResolvedValue({
        valid: true,
        storeId: STORE_UUID,
        scopes: ['inventory:read'],
        keyId: KEY_ID,
      })

      const inventoryQuery = createChainableMock({
        data: [
          {
            id: 'si-1',
            store_id: STORE_UUID,
            quantity: 25,
            par_level: 10,
            unit_cost: 5.99,
            cost_currency: 'USD',
            last_updated_at: '2026-02-10',
            inventory_item: { id: 'item-1', name: 'Tomatoes', category: 'Produce', unit_of_measure: 'kg', is_active: true },
          },
        ],
        error: null,
        count: 1,
      })

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'store_inventory') return inventoryQuery
        if (table === 'api_keys') return createChainableMock({ error: null })
        return createChainableMock({ data: null, error: null })
      })

      const { GET } = await import('@/app/api/v1/inventory/route')
      const request = createAuthenticatedRequest('GET', '/api/v1/inventory')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].name).toBe('Tomatoes')
      expect(data.data[0].quantity).toBe(25)
      expect(data.pagination).toBeDefined()
    })

    it('should support pagination params', async () => {
      const { validateApiKey } = await import('@/lib/api/api-keys')
      vi.mocked(validateApiKey).mockResolvedValue({
        valid: true,
        storeId: STORE_UUID,
        scopes: ['inventory:read'],
        keyId: KEY_ID,
      })

      const inventoryQuery = createChainableMock({
        data: [],
        error: null,
        count: 0,
      })

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'store_inventory') return inventoryQuery
        if (table === 'api_keys') return createChainableMock({ error: null })
        return createChainableMock({ data: null, error: null })
      })

      const { GET } = await import('@/app/api/v1/inventory/route')
      const request = createAuthenticatedRequest('GET', '/api/v1/inventory', undefined, {
        page: '2',
        per_page: '10',
      })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.pagination.page).toBe(2)
      expect(data.pagination.per_page).toBe(10)
    })
  })

  describe('GET /api/v1/stock', () => {
    it('should return 401 without API key', async () => {
      const { validateApiKey } = await import('@/lib/api/api-keys')
      vi.mocked(validateApiKey).mockResolvedValue({ valid: false })

      const { GET } = await import('@/app/api/v1/stock/route')
      const request = createMockRequest('GET', '/api/v1/stock')
      const response = await GET(request)
      expect(response.status).toBe(401)
    })

    it('should return stock history with valid key', async () => {
      const { validateApiKey } = await import('@/lib/api/api-keys')
      vi.mocked(validateApiKey).mockResolvedValue({
        valid: true,
        storeId: STORE_UUID,
        scopes: ['stock:read'],
        keyId: KEY_ID,
      })

      const stockQuery = createChainableMock({
        data: [
          {
            id: 'sh-1',
            store_id: STORE_UUID,
            inventory_item_id: 'item-1',
            action_type: 'Count',
            quantity_before: 20,
            quantity_after: 25,
            quantity_change: 5,
            notes: 'Morning count',
            created_at: '2026-02-10',
            inventory_item: { name: 'Tomatoes', category: 'Produce', unit_of_measure: 'kg' },
          },
        ],
        error: null,
        count: 1,
      })

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'stock_history') return stockQuery
        if (table === 'api_keys') return createChainableMock({ error: null })
        return createChainableMock({ data: null, error: null })
      })

      const { GET } = await import('@/app/api/v1/stock/route')
      const request = createAuthenticatedRequest('GET', '/api/v1/stock')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].item_name).toBe('Tomatoes')
      expect(data.data[0].action_type).toBe('Count')
      expect(data.pagination).toBeDefined()
    })
  })

  describe('POST /api/v1/stock', () => {
    it('should return 401 without API key', async () => {
      const { validateApiKey } = await import('@/lib/api/api-keys')
      vi.mocked(validateApiKey).mockResolvedValue({ valid: false })

      const { POST } = await import('@/app/api/v1/stock/route')
      const request = createMockRequest('POST', '/api/v1/stock', {
        action: 'count',
        items: [{ inventory_item_id: 'item-1', quantity: 10 }],
      })
      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    it('should create stock count with valid key', async () => {
      const { validateApiKey } = await import('@/lib/api/api-keys')
      vi.mocked(validateApiKey).mockResolvedValue({
        valid: true,
        storeId: STORE_UUID,
        scopes: ['stock:write'],
        keyId: KEY_ID,
      })

      const currentInventoryQuery = createChainableMock({
        data: { quantity: 20 },
        error: null,
      })

      const upsertQuery = createChainableMock({ data: null, error: null })
      const insertQuery = createChainableMock({ data: null, error: null })

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'store_inventory') {
          // Return different mocks for select vs upsert
          const mock = createChainableMock({ data: { quantity: 20 }, error: null })
          mock.upsert = vi.fn().mockResolvedValue({ data: null, error: null })
          return mock
        }
        if (table === 'stock_history') return insertQuery
        if (table === 'api_keys') return createChainableMock({ error: null })
        return createChainableMock({ data: null, error: null })
      })

      const { POST } = await import('@/app/api/v1/stock/route')
      const request = createAuthenticatedRequest('POST', '/api/v1/stock', {
        action: 'count',
        items: [{ inventory_item_id: 'item-1', quantity: 25 }],
        notes: 'Evening count',
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.action).toBe('count')
      expect(data.data.processed).toBe(1)
      expect(data.data.results).toHaveLength(1)
      expect(data.data.results[0].success).toBe(true)
    })

    it('should return 400 for invalid action', async () => {
      const { validateApiKey } = await import('@/lib/api/api-keys')
      vi.mocked(validateApiKey).mockResolvedValue({
        valid: true,
        storeId: STORE_UUID,
        scopes: ['stock:write'],
        keyId: KEY_ID,
      })

      mockAdminFrom.mockImplementation(() => createChainableMock({ data: null, error: null }))

      const { POST } = await import('@/app/api/v1/stock/route')
      const request = createAuthenticatedRequest('POST', '/api/v1/stock', {
        action: 'invalid_action',
        items: [{ inventory_item_id: 'item-1', quantity: 10 }],
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should return 400 for empty items array', async () => {
      const { validateApiKey } = await import('@/lib/api/api-keys')
      vi.mocked(validateApiKey).mockResolvedValue({
        valid: true,
        storeId: STORE_UUID,
        scopes: ['stock:write'],
        keyId: KEY_ID,
      })

      mockAdminFrom.mockImplementation(() => createChainableMock({ data: null, error: null }))

      const { POST } = await import('@/app/api/v1/stock/route')
      const request = createAuthenticatedRequest('POST', '/api/v1/stock', {
        action: 'count',
        items: [],
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should return 403 for insufficient scope', async () => {
      const { validateApiKey } = await import('@/lib/api/api-keys')
      vi.mocked(validateApiKey).mockResolvedValue({
        valid: true,
        storeId: STORE_UUID,
        scopes: ['stock:read'],  // read-only scope, not stock:write
        keyId: KEY_ID,
      })

      mockAdminFrom.mockImplementation(() => createChainableMock({ data: null, error: null }))

      const { POST } = await import('@/app/api/v1/stock/route')
      const request = createAuthenticatedRequest('POST', '/api/v1/stock', {
        action: 'count',
        items: [{ inventory_item_id: 'item-1', quantity: 10 }],
      })
      const response = await POST(request)
      expect(response.status).toBe(403)
    })
  })
})
