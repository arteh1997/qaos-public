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

describe('Purchase Orders API', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  const STORE_UUID = '11111111-1111-4111-a111-111111111111'
  const SUPPLIER_UUID = '22222222-2222-4222-a222-222222222222'
  const PO_UUID = '33333333-3333-4333-a333-333333333333'
  const ITEM_UUID = '44444444-4444-4444-a444-444444444444'

  describe('GET /api/stores/[storeId]/purchase-orders', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
      const { GET } = await import('@/app/api/stores/[storeId]/purchase-orders/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/purchase-orders`)
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      expect(response.status).toBe(401)
    })

    it('should return purchase orders for Manager', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Manager', STORE_UUID)

      const posQuery = createChainableMock({
        data: [
          { id: PO_UUID, store_id: STORE_UUID, po_number: 'PO-2026-0001', status: 'draft', total_amount: 250, supplier: { id: SUPPLIER_UUID, name: 'Fresh Foods' } },
        ],
        error: null,
        count: 1,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'purchase_orders') return posQuery
        return storeUsersQuery
      })

      const { GET } = await import('@/app/api/stores/[storeId]/purchase-orders/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/purchase-orders`)
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].po_number).toBe('PO-2026-0001')
    })

    it('should return 403 for Staff', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff', STORE_UUID)
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })
      const { GET } = await import('@/app/api/stores/[storeId]/purchase-orders/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/purchase-orders`)
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      expect(response.status).toBe(403)
    })
  })

  describe('POST /api/stores/[storeId]/purchase-orders', () => {
    it('should create purchase order for Owner', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const supplierQuery = createChainableMock({
        data: { id: SUPPLIER_UUID, name: 'Fresh Foods' },
        error: null,
      })

      // For PO number generation
      const existingPOsQuery = createChainableMock({
        data: [],
        error: null,
      })

      const poInsertQuery = createChainableMock({
        data: { id: PO_UUID, store_id: STORE_UUID, po_number: 'PO-2026-0001', status: 'draft', total_amount: 250 },
        error: null,
      })

      const poItemsInsertQuery = createChainableMock({ data: null, error: null })

      const completePOQuery = createChainableMock({
        data: { id: PO_UUID, store_id: STORE_UUID, po_number: 'PO-2026-0001', status: 'draft', total_amount: 250, supplier: { id: SUPPLIER_UUID, name: 'Fresh Foods' } },
        error: null,
      })

      const poItemsQuery = createChainableMock({
        data: [{ id: 'item-1', inventory_item_id: ITEM_UUID, quantity_ordered: 100, unit_price: 2.50 }],
        error: null,
      })

      let purchaseOrderCallCount = 0
      let purchaseOrderItemsCallCount = 0

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'suppliers') return supplierQuery
        if (table === 'purchase_orders') {
          purchaseOrderCallCount++
          if (purchaseOrderCallCount === 1) return existingPOsQuery // PO number generation
          if (purchaseOrderCallCount === 2) return poInsertQuery // Insert
          return completePOQuery // Final select
        }
        if (table === 'purchase_order_items') {
          purchaseOrderItemsCallCount++
          if (purchaseOrderItemsCallCount === 1) return poItemsInsertQuery
          return poItemsQuery
        }
        return storeUsersQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/purchase-orders/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/purchase-orders`, {
        supplier_id: SUPPLIER_UUID,
        items: [{ inventory_item_id: ITEM_UUID, quantity_ordered: 100, unit_price: 2.50 }],
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
    })

    it('should return 400 for empty items', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      const { POST } = await import('@/app/api/stores/[storeId]/purchase-orders/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/purchase-orders`, {
        supplier_id: SUPPLIER_UUID,
        items: [],
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      expect(response.status).toBe(400)
    })

    it('should return 403 for Driver', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Driver', STORE_UUID)
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })
      const { POST } = await import('@/app/api/stores/[storeId]/purchase-orders/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/purchase-orders`, {
        supplier_id: SUPPLIER_UUID,
        items: [{ inventory_item_id: ITEM_UUID, quantity_ordered: 10, unit_price: 5 }],
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      expect(response.status).toBe(403)
    })
  })

  describe('PUT /api/stores/[storeId]/purchase-orders/[poId]', () => {
    it('should update PO status for Owner', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const currentPOQuery = createChainableMock({
        data: { status: 'draft' },
        error: null,
      })

      const updatePOQuery = createChainableMock({
        data: { id: PO_UUID, status: 'submitted', supplier: { id: SUPPLIER_UUID, name: 'Fresh Foods' } },
        error: null,
      })

      let poCallCount = 0
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'purchase_orders') {
          poCallCount++
          if (poCallCount === 1) return currentPOQuery
          return updatePOQuery
        }
        return storeUsersQuery
      })

      const { PUT } = await import('@/app/api/stores/[storeId]/purchase-orders/[poId]/route')
      const request = createMockRequest('PUT', `/api/stores/${STORE_UUID}/purchase-orders/${PO_UUID}`, {
        status: 'submitted',
      })
      const response = await PUT(request, { params: Promise.resolve({ storeId: STORE_UUID, poId: PO_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should reject invalid status transition', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const currentPOQuery = createChainableMock({
        data: { status: 'received' },
        error: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'purchase_orders') return currentPOQuery
        return storeUsersQuery
      })

      const { PUT } = await import('@/app/api/stores/[storeId]/purchase-orders/[poId]/route')
      const request = createMockRequest('PUT', `/api/stores/${STORE_UUID}/purchase-orders/${PO_UUID}`, {
        status: 'draft',
      })
      const response = await PUT(request, { params: Promise.resolve({ storeId: STORE_UUID, poId: PO_UUID }) })
      expect(response.status).toBe(400)
    })
  })

  describe('DELETE /api/stores/[storeId]/purchase-orders/[poId]', () => {
    it('should delete draft PO', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const statusQuery = createChainableMock({
        data: { status: 'draft' },
        error: null,
      })

      const deleteQuery = createChainableMock({ data: null, error: null })

      let poCallCount = 0
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'purchase_orders') {
          poCallCount++
          if (poCallCount === 1) return statusQuery
          return deleteQuery
        }
        return storeUsersQuery
      })

      const { DELETE } = await import('@/app/api/stores/[storeId]/purchase-orders/[poId]/route')
      const request = createMockRequest('DELETE', `/api/stores/${STORE_UUID}/purchase-orders/${PO_UUID}`)
      const response = await DELETE(request, { params: Promise.resolve({ storeId: STORE_UUID, poId: PO_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should reject deleting non-draft PO', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const statusQuery = createChainableMock({
        data: { status: 'submitted' },
        error: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'purchase_orders') return statusQuery
        return storeUsersQuery
      })

      const { DELETE } = await import('@/app/api/stores/[storeId]/purchase-orders/[poId]/route')
      const request = createMockRequest('DELETE', `/api/stores/${STORE_UUID}/purchase-orders/${PO_UUID}`)
      const response = await DELETE(request, { params: Promise.resolve({ storeId: STORE_UUID, poId: PO_UUID }) })
      expect(response.status).toBe(400)
    })
  })
})
