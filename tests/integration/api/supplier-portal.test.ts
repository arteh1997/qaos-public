import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Chainable Supabase mock ──

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
  mock.then = (resolve: (value: unknown) => unknown) => Promise.resolve(resolvedValue).then(resolve)
  return mock
}

// ── Shared mocks ──

const mockSupabaseClient = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}

const mockAdminClient = {
  from: vi.fn(),
  storage: { from: vi.fn() },
}

const mockWithSupplierAuth = vi.fn()
const mockLogPortalActivity = vi.fn().mockResolvedValue(undefined)
const mockAuditLog = vi.fn().mockResolvedValue(undefined)
const mockGeneratePortalToken = vi.fn(() => ({
  token: 'sp_live_abc123def456',
  tokenHash: 'hash_abc123',
  tokenPrefix: 'sp_live_abc123de',
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ success: true, remaining: 99, resetTime: Date.now() + 60000, limit: 100 })),
  RATE_LIMITS: { api: { limit: 100, windowMs: 60000 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}))
vi.mock('@/lib/audit', () => ({ auditLog: mockAuditLog, computeFieldChanges: vi.fn().mockReturnValue([]) }))
vi.mock('@/lib/csrf', () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
  getCSRFToken: vi.fn().mockResolvedValue('test-csrf-token'),
}))
vi.mock('@/lib/services/supplier-portal', () => ({
  generatePortalToken: mockGeneratePortalToken,
  logPortalActivity: mockLogPortalActivity,
  validatePortalToken: vi.fn(),
  hashPortalToken: vi.fn(),
}))
vi.mock('@/lib/api/with-supplier-auth', () => ({
  withSupplierAuth: mockWithSupplierAuth,
}))

// Mock validation schemas to return Zod-compatible error objects
// (Zod v4 removed .errors getter; route code uses .errors[0]?.message)
function createZodError(message: string) {
  return {
    errors: [{ message }],
    issues: [{ message }],
    message,
  }
}

vi.mock('@/lib/validations/supplier-portal', () => {
  const createPortalTokenSchema = {
    safeParse: (data: Record<string, unknown>) => {
      if (!data.name || typeof data.name !== 'string' || data.name.length === 0) {
        return { success: false, error: createZodError('Token name is required') }
      }
      if (typeof data.name === 'string' && data.name.length > 100) {
        return { success: false, error: createZodError('Token name must be under 100 characters') }
      }
      return {
        success: true,
        data: {
          name: data.name,
          can_view_orders: data.can_view_orders ?? true,
          can_upload_invoices: data.can_upload_invoices ?? true,
          can_update_catalog: data.can_update_catalog ?? true,
          can_update_order_status: data.can_update_order_status ?? false,
          expires_at: data.expires_at,
        },
      }
    },
  }

  const updateOrderStatusSchema = {
    safeParse: (data: Record<string, unknown>) => {
      const validStatuses = ['acknowledged', 'shipped']
      if (!data.status || !validStatuses.includes(data.status as string)) {
        return { success: false, error: createZodError('Invalid status. Must be "acknowledged" or "shipped"') }
      }
      const result: Record<string, unknown> = { status: data.status }
      if (data.notes !== undefined) result.notes = data.notes
      return { success: true, data: result }
    },
  }

  const updateCatalogSchema = {
    safeParse: (data: Record<string, unknown>) => {
      if (!data.items || !Array.isArray(data.items)) {
        return { success: false, error: createZodError('Items must be an array') }
      }
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      for (const item of data.items as Array<Record<string, unknown>>) {
        if (!item.id || !uuidRegex.test(item.id as string)) {
          return { success: false, error: createZodError('Invalid item id') }
        }
        if (item.unit_cost !== undefined && (typeof item.unit_cost !== 'number' || item.unit_cost < 0)) {
          return { success: false, error: createZodError('Unit cost must be positive') }
        }
        if (item.lead_time_days !== undefined && (typeof item.lead_time_days !== 'number' || item.lead_time_days > 365)) {
          return { success: false, error: createZodError('Lead time must be 0-365 days') }
        }
      }
      return { success: true, data: { items: data.items } }
    },
  }

  return {
    createPortalTokenSchema,
    updateOrderStatusSchema,
    updateCatalogSchema,
    updateCatalogItemSchema: {},
    updatePortalTokenSchema: {},
  }
})

// ── Helpers ──

const STORE_UUID = '11111111-1111-4111-a111-111111111111'
const SUPPLIER_UUID = '22222222-2222-4222-a222-222222222222'
const PO_UUID = '33333333-3333-4333-a333-333333333333'
const TOKEN_UUID = '44444444-4444-4444-a444-444444444444'
const ITEM_UUID_1 = '55555555-5555-4555-a555-555555555551'
const ITEM_UUID_2 = '55555555-5555-4555-a555-555555555552'

function createMockRequest(
  method: string,
  path: string,
  body?: object,
  searchParams?: Record<string, string>
): NextRequest {
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

function setupAuthenticatedUser(role: string, storeId: string) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-123', email: 'test@example.com' } },
    error: null,
  })
  const profileQuery = createChainableMock({
    data: { id: 'user-123', role, store_id: null, is_platform_admin: false, default_store_id: null },
    error: null,
  })
  const storeUsersQuery = createChainableMock({
    data: [{
      id: 'su-1',
      store_id: storeId,
      user_id: 'user-123',
      role,
      is_billing_owner: role === 'Owner',
      store: { id: storeId, name: 'Test Store', is_active: true },
    }],
    error: null,
  })
  return { profileQuery, storeUsersQuery }
}

function setupSupplierAuth(
  overrides: Partial<{
    success: boolean
    can_view_orders: boolean
    can_upload_invoices: boolean
    can_update_catalog: boolean
    can_update_order_status: boolean
  }> = {}
) {
  const defaults = {
    success: true,
    can_view_orders: true,
    can_upload_invoices: true,
    can_update_catalog: true,
    can_update_order_status: true,
  }
  const merged = { ...defaults, ...overrides }

  if (!merged.success) {
    mockWithSupplierAuth.mockResolvedValue({
      success: false,
      response: NextResponse.json(
        { success: false, error: 'Invalid or expired portal token.' },
        { status: 401 }
      ),
    })
  } else {
    mockWithSupplierAuth.mockResolvedValue({
      success: true,
      tokenId: TOKEN_UUID,
      supplierId: SUPPLIER_UUID,
      storeId: STORE_UUID,
      supplierName: 'Test Supplier',
      permissions: {
        can_view_orders: merged.can_view_orders,
        can_upload_invoices: merged.can_upload_invoices,
        can_update_catalog: merged.can_update_catalog,
        can_update_order_status: merged.can_update_order_status,
      },
    })
  }
}

function setupSupplierAuthDenied(permission: string) {
  mockWithSupplierAuth.mockResolvedValue({
    success: false,
    response: NextResponse.json(
      { success: false, error: `Insufficient permission: ${permission}` },
      { status: 403 }
    ),
  })
}

// ════════════════════════════════════════════════════════════════════
//  SECTION 1: Portal Token Management API
// ════════════════════════════════════════════════════════════════════

describe('Supplier Portal Token Management API', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  const tokensPath = `/api/stores/${STORE_UUID}/suppliers/${SUPPLIER_UUID}/portal-tokens`

  // ── GET /api/stores/[storeId]/suppliers/[supplierId]/portal-tokens ──

  describe('GET /portal-tokens', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

      const { GET } = await import('@/app/api/stores/[storeId]/suppliers/[supplierId]/portal-tokens/route')
      const request = createMockRequest('GET', tokensPath)
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID, supplierId: SUPPLIER_UUID }),
      })

      expect(response.status).toBe(401)
    })

    it('should return 403 when user cannot manage store', async () => {
      const otherStoreId = '99999999-9999-4999-a999-999999999999'
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', otherStoreId)

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const { GET } = await import('@/app/api/stores/[storeId]/suppliers/[supplierId]/portal-tokens/route')
      const request = createMockRequest('GET', tokensPath)
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID, supplierId: SUPPLIER_UUID }),
      })

      expect(response.status).toBe(403)
    })

    it('should return 403 for Staff role', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff', STORE_UUID)
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const { GET } = await import('@/app/api/stores/[storeId]/suppliers/[supplierId]/portal-tokens/route')
      const request = createMockRequest('GET', tokensPath)
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID, supplierId: SUPPLIER_UUID }),
      })

      expect(response.status).toBe(403)
    })

    it('should return portal tokens for Owner', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const mockTokens = [
        {
          id: TOKEN_UUID,
          supplier_id: SUPPLIER_UUID,
          store_id: STORE_UUID,
          token_prefix: 'sp_live_abc123de',
          name: 'Main Token',
          is_active: true,
          can_view_orders: true,
          can_upload_invoices: true,
          can_update_catalog: false,
          can_update_order_status: false,
          last_used_at: '2026-02-20T10:00:00Z',
          expires_at: null,
          created_at: '2026-02-15T08:00:00Z',
        },
      ]

      const tokensQuery = createChainableMock({ data: mockTokens, error: null })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      mockAdminClient.from.mockReturnValue(tokensQuery)

      const { GET } = await import('@/app/api/stores/[storeId]/suppliers/[supplierId]/portal-tokens/route')
      const request = createMockRequest('GET', tokensPath)
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID, supplierId: SUPPLIER_UUID }),
      })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].name).toBe('Main Token')
      expect(data.data[0].is_active).toBe(true)
    })

    it('should return 500 when database query fails', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const tokensQuery = createChainableMock({ data: null, error: { message: 'DB error' } })
      mockAdminClient.from.mockReturnValue(tokensQuery)

      const { GET } = await import('@/app/api/stores/[storeId]/suppliers/[supplierId]/portal-tokens/route')
      const request = createMockRequest('GET', tokensPath)
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID, supplierId: SUPPLIER_UUID }),
      })

      expect(response.status).toBe(500)
    })
  })

  // ── POST /api/stores/[storeId]/suppliers/[supplierId]/portal-tokens ──

  describe('POST /portal-tokens', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

      const { POST } = await import('@/app/api/stores/[storeId]/suppliers/[supplierId]/portal-tokens/route')
      const request = createMockRequest('POST', tokensPath, { name: 'Test' })
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID, supplierId: SUPPLIER_UUID }),
      })

      expect(response.status).toBe(401)
    })

    it('should return 400 when token name is missing', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/suppliers/[supplierId]/portal-tokens/route')
      const request = createMockRequest('POST', tokensPath, { can_view_orders: true })
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID, supplierId: SUPPLIER_UUID }),
      })

      expect(response.status).toBe(400)
    })

    it('should return 400 when token name exceeds 100 characters', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/suppliers/[supplierId]/portal-tokens/route')
      const request = createMockRequest('POST', tokensPath, { name: 'A'.repeat(101) })
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID, supplierId: SUPPLIER_UUID }),
      })

      expect(response.status).toBe(400)
    })

    it('should return 400 when supplier not found in store', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      // Admin client: supplier lookup returns not found
      const supplierQuery = createChainableMock({ data: null, error: { message: 'Not found' } })
      mockAdminClient.from.mockReturnValue(supplierQuery)

      const { POST } = await import('@/app/api/stores/[storeId]/suppliers/[supplierId]/portal-tokens/route')
      const request = createMockRequest('POST', tokensPath, { name: 'API Token' })
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID, supplierId: SUPPLIER_UUID }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.message).toContain('Supplier not found')
    })

    it('should create token and return plaintext token for Owner', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const supplierQuery = createChainableMock({
        data: { id: SUPPLIER_UUID, name: 'Test Supplier' },
        error: null,
      })

      const createdToken = {
        id: TOKEN_UUID,
        token_prefix: 'sp_live_abc123de',
        name: 'API Token',
        is_active: true,
        can_view_orders: true,
        can_upload_invoices: true,
        can_update_catalog: true,
        can_update_order_status: false,
        expires_at: null,
        created_at: '2026-02-23T08:00:00Z',
      }
      const insertQuery = createChainableMock({ data: createdToken, error: null })

      let callCount = 0
      mockAdminClient.from.mockImplementation(() => {
        callCount++
        if (callCount === 1) return supplierQuery
        return insertQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/suppliers/[supplierId]/portal-tokens/route')
      const request = createMockRequest('POST', tokensPath, {
        name: 'API Token',
        can_view_orders: true,
        can_upload_invoices: true,
        can_update_catalog: true,
        can_update_order_status: false,
      })
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID, supplierId: SUPPLIER_UUID }),
      })

      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.token).toBe('sp_live_abc123def456')
      expect(data.data.name).toBe('API Token')
      expect(data.data.id).toBe(TOKEN_UUID)
    })

    it('should call auditLog after token creation', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const supplierQuery = createChainableMock({
        data: { id: SUPPLIER_UUID, name: 'Test Supplier' },
        error: null,
      })
      const insertQuery = createChainableMock({
        data: { id: TOKEN_UUID, token_prefix: 'sp_live_abc123de', name: 'Audit Token', is_active: true, can_view_orders: true, can_upload_invoices: false, can_update_catalog: false, can_update_order_status: false, expires_at: null, created_at: '2026-02-23T08:00:00Z' },
        error: null,
      })

      let callCount = 0
      mockAdminClient.from.mockImplementation(() => {
        callCount++
        if (callCount === 1) return supplierQuery
        return insertQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/suppliers/[supplierId]/portal-tokens/route')
      const request = createMockRequest('POST', tokensPath, { name: 'Audit Token' })
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID, supplierId: SUPPLIER_UUID }),
      })

      expect(response.status).toBe(201)
      expect(mockAuditLog).toHaveBeenCalledWith(
        mockAdminClient,
        expect.objectContaining({
          userId: 'user-123',
          storeId: STORE_UUID,
          action: 'supplier_portal.token_created',
          details: expect.objectContaining({ supplierId: SUPPLIER_UUID }),
        })
      )
    })

    it('should return 500 when token insert fails', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const supplierQuery = createChainableMock({
        data: { id: SUPPLIER_UUID, name: 'Test Supplier' },
        error: null,
      })
      const insertQuery = createChainableMock({ data: null, error: { message: 'insert failed' } })

      let callCount = 0
      mockAdminClient.from.mockImplementation(() => {
        callCount++
        if (callCount === 1) return supplierQuery
        return insertQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/suppliers/[supplierId]/portal-tokens/route')
      const request = createMockRequest('POST', tokensPath, { name: 'Fail Token' })
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID, supplierId: SUPPLIER_UUID }),
      })

      expect(response.status).toBe(500)
    })

    it('should accept optional expires_at field', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Manager', STORE_UUID)
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const supplierQuery = createChainableMock({
        data: { id: SUPPLIER_UUID, name: 'Test Supplier' },
        error: null,
      })
      const insertQuery = createChainableMock({
        data: { id: TOKEN_UUID, token_prefix: 'sp_live_abc123de', name: 'Expiring Token', is_active: true, can_view_orders: true, can_upload_invoices: true, can_update_catalog: true, can_update_order_status: false, expires_at: '2026-12-31T23:59:59Z', created_at: '2026-02-23T08:00:00Z' },
        error: null,
      })

      let callCount = 0
      mockAdminClient.from.mockImplementation(() => {
        callCount++
        if (callCount === 1) return supplierQuery
        return insertQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/suppliers/[supplierId]/portal-tokens/route')
      const request = createMockRequest('POST', tokensPath, {
        name: 'Expiring Token',
        expires_at: '2026-12-31T23:59:59Z',
      })
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID, supplierId: SUPPLIER_UUID }),
      })

      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data.success).toBe(true)
    })
  })
})

// ════════════════════════════════════════════════════════════════════
//  SECTION 2: Supplier Portal Orders API
// ════════════════════════════════════════════════════════════════════

describe('Supplier Portal Orders API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── GET /api/supplier-portal/orders ──

  describe('GET /api/supplier-portal/orders', () => {
    it('should return 401 when portal token is missing', async () => {
      setupSupplierAuth({ success: false })

      const { GET } = await import('@/app/api/supplier-portal/orders/route')
      const request = createMockRequest('GET', '/api/supplier-portal/orders')
      const response = await GET(request)

      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
    })

    it('should return orders for authenticated supplier', async () => {
      setupSupplierAuth()

      const mockOrders = [
        {
          id: PO_UUID,
          po_number: 'PO-001',
          status: 'submitted',
          order_date: '2026-02-20',
          expected_delivery_date: '2026-02-25',
          total_amount: 150.00,
          currency: 'GBP',
          notes: null,
          created_at: '2026-02-20T08:00:00Z',
        },
      ]

      const ordersQuery = createChainableMock({ data: mockOrders, count: 1, error: null })
      mockAdminClient.from.mockReturnValue(ordersQuery)

      const { GET } = await import('@/app/api/supplier-portal/orders/route')
      const request = createMockRequest('GET', '/api/supplier-portal/orders')
      const response = await GET(request)

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].po_number).toBe('PO-001')
      expect(data.pagination).toBeDefined()
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.limit).toBe(20)
    })

    it('should filter orders by status query parameter', async () => {
      setupSupplierAuth()

      const ordersQuery = createChainableMock({ data: [], count: 0, error: null })
      mockAdminClient.from.mockReturnValue(ordersQuery)

      const { GET } = await import('@/app/api/supplier-portal/orders/route')
      const request = createMockRequest('GET', '/api/supplier-portal/orders', undefined, { status: 'submitted' })
      const response = await GET(request)

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // Verify the .eq method was called (status filter applied)
      expect(ordersQuery.eq).toHaveBeenCalled()
    })

    it('should support pagination with page parameter', async () => {
      setupSupplierAuth()

      const ordersQuery = createChainableMock({ data: [], count: 50, error: null })
      mockAdminClient.from.mockReturnValue(ordersQuery)

      const { GET } = await import('@/app/api/supplier-portal/orders/route')
      const request = createMockRequest('GET', '/api/supplier-portal/orders', undefined, { page: '3' })
      const response = await GET(request)

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.pagination.page).toBe(3)
      // range should be called with offset 40..59 (page 3, limit 20)
      expect(ordersQuery.range).toHaveBeenCalledWith(40, 59)
    })

    it('should default to page 1 for invalid page values', async () => {
      setupSupplierAuth()

      const ordersQuery = createChainableMock({ data: [], count: 0, error: null })
      mockAdminClient.from.mockReturnValue(ordersQuery)

      const { GET } = await import('@/app/api/supplier-portal/orders/route')
      const request = createMockRequest('GET', '/api/supplier-portal/orders', undefined, { page: '-5' })
      const response = await GET(request)

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.pagination.page).toBe(1)
    })

    it('should return 500 when database query fails', async () => {
      setupSupplierAuth()

      const ordersQuery = createChainableMock({ data: null, count: null, error: { message: 'DB error' } })
      mockAdminClient.from.mockReturnValue(ordersQuery)

      const { GET } = await import('@/app/api/supplier-portal/orders/route')
      const request = createMockRequest('GET', '/api/supplier-portal/orders')
      const response = await GET(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.success).toBe(false)
    })
  })

  // ── GET /api/supplier-portal/orders/[poId] ──

  describe('GET /api/supplier-portal/orders/[poId]', () => {
    it('should return 401 without portal token', async () => {
      setupSupplierAuth({ success: false })

      const { GET } = await import('@/app/api/supplier-portal/orders/[poId]/route')
      const request = createMockRequest('GET', `/api/supplier-portal/orders/${PO_UUID}`)
      const response = await GET(request, { params: Promise.resolve({ poId: PO_UUID }) })

      expect(response.status).toBe(401)
    })

    it('should return order with line items', async () => {
      setupSupplierAuth()

      const mockOrder = {
        id: PO_UUID,
        po_number: 'PO-001',
        status: 'submitted',
        order_date: '2026-02-20',
        expected_delivery_date: '2026-02-25',
        total_amount: 250.00,
        currency: 'GBP',
        notes: 'Urgent delivery',
        created_at: '2026-02-20T08:00:00Z',
        purchase_order_items: [
          {
            id: 'item-1',
            inventory_item_id: ITEM_UUID_1,
            quantity_ordered: 10,
            quantity_received: 0,
            unit_price: 25.00,
            notes: null,
            inventory_items: { name: 'Tomatoes', unit_of_measure: 'kg' },
          },
        ],
      }

      const orderQuery = createChainableMock({ data: mockOrder, error: null })
      mockAdminClient.from.mockReturnValue(orderQuery)

      const { GET } = await import('@/app/api/supplier-portal/orders/[poId]/route')
      const request = createMockRequest('GET', `/api/supplier-portal/orders/${PO_UUID}`)
      const response = await GET(request, { params: Promise.resolve({ poId: PO_UUID }) })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.po_number).toBe('PO-001')
      expect(data.data.purchase_order_items).toHaveLength(1)
      expect(data.data.purchase_order_items[0].inventory_items.name).toBe('Tomatoes')
    })

    it('should return 404 when order not found', async () => {
      setupSupplierAuth()

      const orderQuery = createChainableMock({ data: null, error: { message: 'Not found' } })
      mockAdminClient.from.mockReturnValue(orderQuery)

      const { GET } = await import('@/app/api/supplier-portal/orders/[poId]/route')
      const request = createMockRequest('GET', `/api/supplier-portal/orders/${PO_UUID}`)
      const response = await GET(request, { params: Promise.resolve({ poId: PO_UUID }) })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Order not found')
    })
  })

  // ── PATCH /api/supplier-portal/orders/[poId] ──

  describe('PATCH /api/supplier-portal/orders/[poId]', () => {
    it('should return 401 without portal token', async () => {
      setupSupplierAuth({ success: false })

      const { PATCH } = await import('@/app/api/supplier-portal/orders/[poId]/route')
      const request = createMockRequest('PATCH', `/api/supplier-portal/orders/${PO_UUID}`, { status: 'acknowledged' })
      const response = await PATCH(request, { params: Promise.resolve({ poId: PO_UUID }) })

      expect(response.status).toBe(401)
    })

    it('should return 403 when can_update_order_status permission is missing', async () => {
      setupSupplierAuthDenied('can_update_order_status')

      const { PATCH } = await import('@/app/api/supplier-portal/orders/[poId]/route')
      const request = createMockRequest('PATCH', `/api/supplier-portal/orders/${PO_UUID}`, { status: 'acknowledged' })
      const response = await PATCH(request, { params: Promise.resolve({ poId: PO_UUID }) })

      expect(response.status).toBe(403)
    })

    it('should return 400 for invalid status value', async () => {
      setupSupplierAuth()

      const { PATCH } = await import('@/app/api/supplier-portal/orders/[poId]/route')
      const request = createMockRequest('PATCH', `/api/supplier-portal/orders/${PO_UUID}`, { status: 'invalid_status' })
      const response = await PATCH(request, { params: Promise.resolve({ poId: PO_UUID }) })

      expect(response.status).toBe(400)
    })

    it('should return 404 when order not found for this supplier', async () => {
      setupSupplierAuth()

      const existingQuery = createChainableMock({ data: null, error: null })
      mockAdminClient.from.mockReturnValue(existingQuery)

      const { PATCH } = await import('@/app/api/supplier-portal/orders/[poId]/route')
      const request = createMockRequest('PATCH', `/api/supplier-portal/orders/${PO_UUID}`, { status: 'acknowledged' })
      const response = await PATCH(request, { params: Promise.resolve({ poId: PO_UUID }) })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Order not found')
    })

    it('should acknowledge an open order successfully', async () => {
      setupSupplierAuth()

      const existingQuery = createChainableMock({ data: { id: PO_UUID, status: 'open' }, error: null })
      const updateQuery = createChainableMock({ error: null })

      let callCount = 0
      mockAdminClient.from.mockImplementation(() => {
        callCount++
        if (callCount === 1) return existingQuery
        return updateQuery
      })

      const { PATCH } = await import('@/app/api/supplier-portal/orders/[poId]/route')
      const request = createMockRequest('PATCH', `/api/supplier-portal/orders/${PO_UUID}`, { status: 'acknowledged' })
      const response = await PATCH(request, { params: Promise.resolve({ poId: PO_UUID }) })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // 'acknowledged' maps to 'awaiting_delivery' system status
      expect(data.data.status).toBe('awaiting_delivery')
    })

    it('should mark an acknowledged order as shipped', async () => {
      setupSupplierAuth()

      const existingQuery = createChainableMock({ data: { id: PO_UUID, status: 'acknowledged' }, error: null })
      const updateQuery = createChainableMock({ error: null })

      let callCount = 0
      mockAdminClient.from.mockImplementation(() => {
        callCount++
        if (callCount === 1) return existingQuery
        return updateQuery
      })

      const { PATCH } = await import('@/app/api/supplier-portal/orders/[poId]/route')
      const request = createMockRequest('PATCH', `/api/supplier-portal/orders/${PO_UUID}`, { status: 'shipped' })
      const response = await PATCH(request, { params: Promise.resolve({ poId: PO_UUID }) })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('awaiting_delivery')
    })

    it('should allow awaiting_delivery order to be acknowledged', async () => {
      setupSupplierAuth()

      const existingQuery = createChainableMock({ data: { id: PO_UUID, status: 'awaiting_delivery' }, error: null })
      const updateQuery = createChainableMock({ error: null })

      let callCount = 0
      mockAdminClient.from.mockImplementation(() => {
        callCount++
        if (callCount === 1) return existingQuery
        return updateQuery
      })

      const { PATCH } = await import('@/app/api/supplier-portal/orders/[poId]/route')
      const request = createMockRequest('PATCH', `/api/supplier-portal/orders/${PO_UUID}`, { status: 'acknowledged' })
      const response = await PATCH(request, { params: Promise.resolve({ poId: PO_UUID }) })

      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should reject invalid status transition (received -> acknowledged)', async () => {
      setupSupplierAuth()

      const existingQuery = createChainableMock({ data: { id: PO_UUID, status: 'received' }, error: null })
      mockAdminClient.from.mockReturnValue(existingQuery)

      const { PATCH } = await import('@/app/api/supplier-portal/orders/[poId]/route')
      const request = createMockRequest('PATCH', `/api/supplier-portal/orders/${PO_UUID}`, { status: 'acknowledged' })
      const response = await PATCH(request, { params: Promise.resolve({ poId: PO_UUID }) })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Cannot transition')
    })

    it('should reject invalid transition (cancelled -> shipped)', async () => {
      setupSupplierAuth()

      const existingQuery = createChainableMock({ data: { id: PO_UUID, status: 'cancelled' }, error: null })
      mockAdminClient.from.mockReturnValue(existingQuery)

      const { PATCH } = await import('@/app/api/supplier-portal/orders/[poId]/route')
      const request = createMockRequest('PATCH', `/api/supplier-portal/orders/${PO_UUID}`, { status: 'shipped' })
      const response = await PATCH(request, { params: Promise.resolve({ poId: PO_UUID }) })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Cannot transition')
    })

    it('should log portal activity after status update', async () => {
      setupSupplierAuth()

      const existingQuery = createChainableMock({ data: { id: PO_UUID, status: 'open' }, error: null })
      const updateQuery = createChainableMock({ error: null })

      let callCount = 0
      mockAdminClient.from.mockImplementation(() => {
        callCount++
        if (callCount === 1) return existingQuery
        return updateQuery
      })

      const { PATCH } = await import('@/app/api/supplier-portal/orders/[poId]/route')
      const request = createMockRequest('PATCH', `/api/supplier-portal/orders/${PO_UUID}`, { status: 'acknowledged' })
      await PATCH(request, { params: Promise.resolve({ poId: PO_UUID }) })

      expect(mockLogPortalActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          supplierId: SUPPLIER_UUID,
          storeId: STORE_UUID,
          tokenId: TOKEN_UUID,
          action: 'order.status_updated',
          details: expect.objectContaining({ poId: PO_UUID, from: 'open', to: 'acknowledged' }),
        })
      )
    })

    it('should include notes in the update when provided', async () => {
      setupSupplierAuth()

      const existingQuery = createChainableMock({ data: { id: PO_UUID, status: 'open' }, error: null })
      const updateQuery = createChainableMock({ error: null })

      let callCount = 0
      mockAdminClient.from.mockImplementation(() => {
        callCount++
        if (callCount === 1) return existingQuery
        return updateQuery
      })

      const { PATCH } = await import('@/app/api/supplier-portal/orders/[poId]/route')
      const request = createMockRequest('PATCH', `/api/supplier-portal/orders/${PO_UUID}`, {
        status: 'acknowledged',
        notes: 'Will deliver by Friday',
      })
      const response = await PATCH(request, { params: Promise.resolve({ poId: PO_UUID }) })

      expect(response.status).toBe(200)
      // Verify update was called with notes
      expect(updateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({ notes: 'Will deliver by Friday' })
      )
    })

    it('should return 500 when update fails', async () => {
      setupSupplierAuth()

      const existingQuery = createChainableMock({ data: { id: PO_UUID, status: 'open' }, error: null })
      const updateQuery = createChainableMock({ error: { message: 'update failed' } })

      let callCount = 0
      mockAdminClient.from.mockImplementation(() => {
        callCount++
        if (callCount === 1) return existingQuery
        return updateQuery
      })

      const { PATCH } = await import('@/app/api/supplier-portal/orders/[poId]/route')
      const request = createMockRequest('PATCH', `/api/supplier-portal/orders/${PO_UUID}`, { status: 'acknowledged' })
      const response = await PATCH(request, { params: Promise.resolve({ poId: PO_UUID }) })

      expect(response.status).toBe(500)
    })
  })
})

// ════════════════════════════════════════════════════════════════════
//  SECTION 3: Supplier Portal Catalog API
// ════════════════════════════════════════════════════════════════════

describe('Supplier Portal Catalog API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── GET /api/supplier-portal/catalog ──

  describe('GET /api/supplier-portal/catalog', () => {
    it('should return 401 without portal token', async () => {
      setupSupplierAuth({ success: false })

      const { GET } = await import('@/app/api/supplier-portal/catalog/route')
      const request = createMockRequest('GET', '/api/supplier-portal/catalog')
      const response = await GET(request)

      expect(response.status).toBe(401)
    })

    it('should return 403 when can_update_catalog permission is missing', async () => {
      setupSupplierAuthDenied('can_update_catalog')

      const { GET } = await import('@/app/api/supplier-portal/catalog/route')
      const request = createMockRequest('GET', '/api/supplier-portal/catalog')
      const response = await GET(request)

      expect(response.status).toBe(403)
    })

    it('should return supplier items with inventory details', async () => {
      setupSupplierAuth()

      const mockItems = [
        {
          id: ITEM_UUID_1,
          supplier_sku: 'TOM-001',
          unit_cost: 2.50,
          currency: 'GBP',
          lead_time_days: 2,
          min_order_quantity: 5,
          is_preferred: true,
          is_active: true,
          inventory_items: { id: 'inv-1', name: 'Tomatoes', unit_of_measure: 'kg', category: 'Produce' },
        },
        {
          id: ITEM_UUID_2,
          supplier_sku: 'ON-002',
          unit_cost: 1.80,
          currency: 'GBP',
          lead_time_days: 2,
          min_order_quantity: 10,
          is_preferred: false,
          is_active: true,
          inventory_items: { id: 'inv-2', name: 'Onions', unit_of_measure: 'kg', category: 'Produce' },
        },
      ]

      const itemsQuery = createChainableMock({ data: mockItems, error: null })
      mockAdminClient.from.mockReturnValue(itemsQuery)

      const { GET } = await import('@/app/api/supplier-portal/catalog/route')
      const request = createMockRequest('GET', '/api/supplier-portal/catalog')
      const response = await GET(request)

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(2)
      expect(data.data[0].supplier_sku).toBe('TOM-001')
      expect(data.data[0].inventory_items.name).toBe('Tomatoes')
      expect(data.data[1].inventory_items.name).toBe('Onions')
    })

    it('should return empty list when supplier has no items', async () => {
      setupSupplierAuth()

      const itemsQuery = createChainableMock({ data: [], error: null })
      mockAdminClient.from.mockReturnValue(itemsQuery)

      const { GET } = await import('@/app/api/supplier-portal/catalog/route')
      const request = createMockRequest('GET', '/api/supplier-portal/catalog')
      const response = await GET(request)

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(0)
    })

    it('should return 500 when database query fails', async () => {
      setupSupplierAuth()

      const itemsQuery = createChainableMock({ data: null, error: { message: 'DB error' } })
      mockAdminClient.from.mockReturnValue(itemsQuery)

      const { GET } = await import('@/app/api/supplier-portal/catalog/route')
      const request = createMockRequest('GET', '/api/supplier-portal/catalog')
      const response = await GET(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.success).toBe(false)
    })
  })

  // ── PUT /api/supplier-portal/catalog ──

  describe('PUT /api/supplier-portal/catalog', () => {
    it('should return 401 without portal token', async () => {
      setupSupplierAuth({ success: false })

      const { PUT } = await import('@/app/api/supplier-portal/catalog/route')
      const request = createMockRequest('PUT', '/api/supplier-portal/catalog', {
        items: [{ id: ITEM_UUID_1, unit_cost: 3.00 }],
      })
      const response = await PUT(request)

      expect(response.status).toBe(401)
    })

    it('should return 400 for invalid request body', async () => {
      setupSupplierAuth()

      const { PUT } = await import('@/app/api/supplier-portal/catalog/route')
      const request = createMockRequest('PUT', '/api/supplier-portal/catalog', { items: 'not_an_array' })
      const response = await PUT(request)

      expect(response.status).toBe(400)
    })

    it('should return 400 for invalid item id (non-uuid)', async () => {
      setupSupplierAuth()

      const { PUT } = await import('@/app/api/supplier-portal/catalog/route')
      const request = createMockRequest('PUT', '/api/supplier-portal/catalog', {
        items: [{ id: 'not-a-uuid', unit_cost: 3.00 }],
      })
      const response = await PUT(request)

      expect(response.status).toBe(400)
    })

    it('should bulk update pricing successfully', async () => {
      setupSupplierAuth()

      const existingQuery = createChainableMock({ data: { id: ITEM_UUID_1 }, error: null })
      const updateQuery = createChainableMock({ error: null })

      let callCount = 0
      mockAdminClient.from.mockImplementation(() => {
        callCount++
        if (callCount % 2 === 1) return existingQuery
        return updateQuery
      })

      const { PUT } = await import('@/app/api/supplier-portal/catalog/route')
      const request = createMockRequest('PUT', '/api/supplier-portal/catalog', {
        items: [{ id: ITEM_UUID_1, unit_cost: 3.50, lead_time_days: 3 }],
      })
      const response = await PUT(request)

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].id).toBe(ITEM_UUID_1)
      expect(data.data[0].success).toBe(true)
    })

    it('should return item not found for items not belonging to supplier', async () => {
      setupSupplierAuth()

      const notFoundQuery = createChainableMock({ data: null, error: null })
      mockAdminClient.from.mockReturnValue(notFoundQuery)

      const { PUT } = await import('@/app/api/supplier-portal/catalog/route')
      const request = createMockRequest('PUT', '/api/supplier-portal/catalog', {
        items: [{ id: ITEM_UUID_1, unit_cost: 3.00 }],
      })
      const response = await PUT(request)

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data[0].success).toBe(false)
      expect(data.data[0].error).toBe('Item not found')
    })

    it('should log portal activity after catalog update', async () => {
      setupSupplierAuth()

      const existingQuery = createChainableMock({ data: { id: ITEM_UUID_1 }, error: null })
      const updateQuery = createChainableMock({ error: null })

      let callCount = 0
      mockAdminClient.from.mockImplementation(() => {
        callCount++
        if (callCount % 2 === 1) return existingQuery
        return updateQuery
      })

      const { PUT } = await import('@/app/api/supplier-portal/catalog/route')
      const request = createMockRequest('PUT', '/api/supplier-portal/catalog', {
        items: [{ id: ITEM_UUID_1, unit_cost: 4.00 }],
      })
      await PUT(request)

      expect(mockLogPortalActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          supplierId: SUPPLIER_UUID,
          storeId: STORE_UUID,
          tokenId: TOKEN_UUID,
          action: 'catalog.updated',
          details: { itemCount: 1 },
        })
      )
    })

    it('should handle multiple items in bulk update with mixed results', async () => {
      setupSupplierAuth()

      const foundQuery = createChainableMock({ data: { id: ITEM_UUID_1 }, error: null })
      const notFoundQuery = createChainableMock({ data: null, error: null })
      const updateQuery = createChainableMock({ error: null })

      // Item 1: found -> update; Item 2: not found
      let callCount = 0
      mockAdminClient.from.mockImplementation(() => {
        callCount++
        if (callCount === 1) return foundQuery  // lookup item 1
        if (callCount === 2) return updateQuery  // update item 1
        if (callCount === 3) return notFoundQuery  // lookup item 2, not found
        return updateQuery
      })

      const { PUT } = await import('@/app/api/supplier-portal/catalog/route')
      const request = createMockRequest('PUT', '/api/supplier-portal/catalog', {
        items: [
          { id: ITEM_UUID_1, unit_cost: 3.00 },
          { id: ITEM_UUID_2, unit_cost: 2.00 },
        ],
      })
      const response = await PUT(request)

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toHaveLength(2)
      expect(data.data[0].success).toBe(true)
      expect(data.data[1].success).toBe(false)
      expect(data.data[1].error).toBe('Item not found')
    })

    it('should reject negative unit_cost', async () => {
      setupSupplierAuth()

      const { PUT } = await import('@/app/api/supplier-portal/catalog/route')
      const request = createMockRequest('PUT', '/api/supplier-portal/catalog', {
        items: [{ id: ITEM_UUID_1, unit_cost: -5.00 }],
      })
      const response = await PUT(request)

      expect(response.status).toBe(400)
    })

    it('should reject lead_time_days exceeding 365', async () => {
      setupSupplierAuth()

      const { PUT } = await import('@/app/api/supplier-portal/catalog/route')
      const request = createMockRequest('PUT', '/api/supplier-portal/catalog', {
        items: [{ id: ITEM_UUID_1, lead_time_days: 400 }],
      })
      const response = await PUT(request)

      expect(response.status).toBe(400)
    })
  })
})

// ════════════════════════════════════════════════════════════════════
//  SECTION 4: Supplier Portal Invoices API
// ════════════════════════════════════════════════════════════════════

describe('Supplier Portal Invoices API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── GET /api/supplier-portal/invoices ──

  describe('GET /api/supplier-portal/invoices', () => {
    it('should return 401 without portal token', async () => {
      setupSupplierAuth({ success: false })

      const { GET } = await import('@/app/api/supplier-portal/invoices/route')
      const request = createMockRequest('GET', '/api/supplier-portal/invoices')
      const response = await GET(request)

      expect(response.status).toBe(401)
    })

    it('should return 403 when can_upload_invoices permission is missing', async () => {
      setupSupplierAuthDenied('can_upload_invoices')

      const { GET } = await import('@/app/api/supplier-portal/invoices/route')
      const request = createMockRequest('GET', '/api/supplier-portal/invoices')
      const response = await GET(request)

      expect(response.status).toBe(403)
    })

    it('should return invoices for authenticated supplier', async () => {
      setupSupplierAuth()

      const mockInvoices = [
        {
          id: 'inv-1',
          invoice_number: 'INV-001',
          invoice_date: '2026-02-15',
          due_date: '2026-03-15',
          total_amount: 500.00,
          currency: 'GBP',
          status: 'pending',
          file_name: 'invoice-001.pdf',
          created_at: '2026-02-15T10:00:00Z',
        },
      ]

      const invoicesQuery = createChainableMock({ data: mockInvoices, error: null })
      mockAdminClient.from.mockReturnValue(invoicesQuery)

      const { GET } = await import('@/app/api/supplier-portal/invoices/route')
      const request = createMockRequest('GET', '/api/supplier-portal/invoices')
      const response = await GET(request)

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].invoice_number).toBe('INV-001')
      expect(data.data[0].status).toBe('pending')
    })

    it('should return empty list when no invoices exist', async () => {
      setupSupplierAuth()

      const invoicesQuery = createChainableMock({ data: [], error: null })
      mockAdminClient.from.mockReturnValue(invoicesQuery)

      const { GET } = await import('@/app/api/supplier-portal/invoices/route')
      const request = createMockRequest('GET', '/api/supplier-portal/invoices')
      const response = await GET(request)

      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.data).toHaveLength(0)
    })

    it('should return 500 when database query fails', async () => {
      setupSupplierAuth()

      const invoicesQuery = createChainableMock({ data: null, error: { message: 'DB error' } })
      mockAdminClient.from.mockReturnValue(invoicesQuery)

      const { GET } = await import('@/app/api/supplier-portal/invoices/route')
      const request = createMockRequest('GET', '/api/supplier-portal/invoices')
      const response = await GET(request)

      expect(response.status).toBe(500)
    })
  })

  // ── POST /api/supplier-portal/invoices ──

  describe('POST /api/supplier-portal/invoices', () => {
    function createFormDataRequest(
      fields: Record<string, string | File>,
      path = '/api/supplier-portal/invoices'
    ): NextRequest {
      const url = new URL(`http://localhost:3000${path}`)
      const formData = new FormData()
      for (const [key, value] of Object.entries(fields)) {
        formData.append(key, value)
      }
      return {
        method: 'POST',
        nextUrl: url,
        url: url.toString(),
        formData: vi.fn(() => Promise.resolve(formData)),
        headers: new Headers(),
        cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
      } as unknown as NextRequest
    }

    it('should return 401 without portal token', async () => {
      setupSupplierAuth({ success: false })

      const { POST } = await import('@/app/api/supplier-portal/invoices/route')
      const request = createFormDataRequest({})
      const response = await POST(request)

      expect(response.status).toBe(401)
    })

    it('should return 400 when no file provided', async () => {
      setupSupplierAuth()

      const { POST } = await import('@/app/api/supplier-portal/invoices/route')
      const request = createFormDataRequest({ invoice_number: 'INV-002' })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('No file provided')
    })

    it('should return 400 for disallowed file type', async () => {
      setupSupplierAuth()

      const file = new File(['content'], 'malware.exe', { type: 'application/x-msdownload' })

      const { POST } = await import('@/app/api/supplier-portal/invoices/route')
      const request = createFormDataRequest({ file })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('File must be JPEG, PNG, WebP, or PDF')
    })

    it('should return 400 for file exceeding 10MB', async () => {
      setupSupplierAuth()

      // Create a file that exceeds 10MB
      const largeContent = new ArrayBuffer(11 * 1024 * 1024)
      const file = new File([largeContent], 'huge-invoice.pdf', { type: 'application/pdf' })

      const { POST } = await import('@/app/api/supplier-portal/invoices/route')
      const request = createFormDataRequest({ file })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('File must be under 10MB')
    })

    it('should accept PDF files and create invoice record', async () => {
      setupSupplierAuth()

      const file = new File(['%PDF-1.4 test content'], 'invoice.pdf', { type: 'application/pdf' })

      const uploadMock = vi.fn().mockResolvedValue({ error: null })
      mockAdminClient.storage.from.mockReturnValue({ upload: uploadMock })

      const insertQuery = createChainableMock({
        data: { id: 'inv-new', file_name: 'invoice.pdf', status: 'pending', created_at: '2026-02-23T10:00:00Z' },
        error: null,
      })
      mockAdminClient.from.mockReturnValue(insertQuery)

      const { POST } = await import('@/app/api/supplier-portal/invoices/route')
      const request = createFormDataRequest({ file, invoice_number: 'INV-002' })
      const response = await POST(request)

      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.file_name).toBe('invoice.pdf')
      expect(data.data.status).toBe('pending')
    })

    it('should accept JPEG image files', async () => {
      setupSupplierAuth()

      const file = new File(['jpeg content'], 'receipt.jpg', { type: 'image/jpeg' })

      const uploadMock = vi.fn().mockResolvedValue({ error: null })
      mockAdminClient.storage.from.mockReturnValue({ upload: uploadMock })

      const insertQuery = createChainableMock({
        data: { id: 'inv-jpeg', file_name: 'receipt.jpg', status: 'pending', created_at: '2026-02-23T10:00:00Z' },
        error: null,
      })
      mockAdminClient.from.mockReturnValue(insertQuery)

      const { POST } = await import('@/app/api/supplier-portal/invoices/route')
      const request = createFormDataRequest({ file })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should accept PNG image files', async () => {
      setupSupplierAuth()

      const file = new File(['png content'], 'scan.png', { type: 'image/png' })

      const uploadMock = vi.fn().mockResolvedValue({ error: null })
      mockAdminClient.storage.from.mockReturnValue({ upload: uploadMock })

      const insertQuery = createChainableMock({
        data: { id: 'inv-png', file_name: 'scan.png', status: 'pending', created_at: '2026-02-23T10:00:00Z' },
        error: null,
      })
      mockAdminClient.from.mockReturnValue(insertQuery)

      const { POST } = await import('@/app/api/supplier-portal/invoices/route')
      const request = createFormDataRequest({ file })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should accept WebP image files', async () => {
      setupSupplierAuth()

      const file = new File(['webp content'], 'photo.webp', { type: 'image/webp' })

      const uploadMock = vi.fn().mockResolvedValue({ error: null })
      mockAdminClient.storage.from.mockReturnValue({ upload: uploadMock })

      const insertQuery = createChainableMock({
        data: { id: 'inv-webp', file_name: 'photo.webp', status: 'pending', created_at: '2026-02-23T10:00:00Z' },
        error: null,
      })
      mockAdminClient.from.mockReturnValue(insertQuery)

      const { POST } = await import('@/app/api/supplier-portal/invoices/route')
      const request = createFormDataRequest({ file })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should return 500 when file upload to storage fails', async () => {
      setupSupplierAuth()

      const file = new File(['pdf content'], 'invoice.pdf', { type: 'application/pdf' })

      const uploadMock = vi.fn().mockResolvedValue({ error: { message: 'Storage error' } })
      mockAdminClient.storage.from.mockReturnValue({ upload: uploadMock })

      const { POST } = await import('@/app/api/supplier-portal/invoices/route')
      const request = createFormDataRequest({ file })
      const response = await POST(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('Failed to upload file')
    })

    it('should return 500 when invoice record insert fails', async () => {
      setupSupplierAuth()

      const file = new File(['pdf content'], 'invoice.pdf', { type: 'application/pdf' })

      const uploadMock = vi.fn().mockResolvedValue({ error: null })
      mockAdminClient.storage.from.mockReturnValue({ upload: uploadMock })

      const insertQuery = createChainableMock({ data: null, error: { message: 'Insert error' } })
      mockAdminClient.from.mockReturnValue(insertQuery)

      const { POST } = await import('@/app/api/supplier-portal/invoices/route')
      const request = createFormDataRequest({ file })
      const response = await POST(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('Failed to create invoice record')
    })

    it('should log portal activity after successful upload', async () => {
      setupSupplierAuth()

      const file = new File(['pdf content'], 'invoice-log.pdf', { type: 'application/pdf' })

      const uploadMock = vi.fn().mockResolvedValue({ error: null })
      mockAdminClient.storage.from.mockReturnValue({ upload: uploadMock })

      const insertQuery = createChainableMock({
        data: { id: 'inv-logged', file_name: 'invoice-log.pdf', status: 'pending', created_at: '2026-02-23T10:00:00Z' },
        error: null,
      })
      mockAdminClient.from.mockReturnValue(insertQuery)

      const { POST } = await import('@/app/api/supplier-portal/invoices/route')
      const request = createFormDataRequest({ file })
      await POST(request)

      expect(mockLogPortalActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          supplierId: SUPPLIER_UUID,
          storeId: STORE_UUID,
          tokenId: TOKEN_UUID,
          action: 'invoice.uploaded',
          details: expect.objectContaining({ invoiceId: 'inv-logged', fileName: 'invoice-log.pdf' }),
        })
      )
    })
  })
})
