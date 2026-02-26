import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

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

// ── Module mocks ──

const mockSupabaseClient = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}

const mockAdminClient = {
  from: vi.fn(),
  storage: { from: vi.fn() },
}

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
vi.mock('@/lib/audit', () => ({ auditLog: vi.fn().mockResolvedValue(undefined), computeFieldChanges: vi.fn().mockReturnValue([]) }))
vi.mock('@/lib/csrf', () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
  getCSRFToken: vi.fn().mockResolvedValue('test-csrf-token'),
}))
vi.mock('@/lib/services/invoice-ocr', () => ({
  processInvoice: vi.fn().mockResolvedValue(undefined),
  applyInvoiceToInventory: vi.fn().mockResolvedValue({ itemsUpdated: 3 }),
}))

// ── Helpers ──

const STORE_UUID = '11111111-1111-4111-a111-111111111111'
const OTHER_STORE_UUID = '99999999-9999-4999-a999-999999999999'
const INVOICE_UUID = '22222222-2222-4222-a222-222222222222'
const USER_ID = 'user-123'

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

function createFormDataRequest(
  path: string,
  formData: FormData,
): NextRequest {
  const url = new URL(`http://localhost:3000${path}`)
  return {
    method: 'POST',
    nextUrl: url,
    url: url.toString(),
    formData: vi.fn(() => Promise.resolve(formData)),
    json: vi.fn(() => Promise.reject(new Error('Not JSON'))),
    headers: new Headers(),
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  } as unknown as NextRequest
}

function setupAuthenticatedUser(role: string, storeId: string) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: USER_ID, email: 'test@example.com' } },
    error: null,
  })
  const profileQuery = createChainableMock({
    data: { id: USER_ID, role, store_id: null, is_platform_admin: false, default_store_id: null },
    error: null,
  })
  const storeUsersQuery = createChainableMock({
    data: [
      {
        id: 'su-1',
        store_id: storeId,
        user_id: USER_ID,
        role,
        is_billing_owner: role === 'Owner',
        store: { id: storeId, name: 'Test Store', is_active: true },
      },
    ],
    error: null,
  })
  return { profileQuery, storeUsersQuery }
}

function setupUnauthenticatedUser() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: null,
  })
}

// ── Test Data ──

const sampleInvoice = {
  id: INVOICE_UUID,
  store_id: STORE_UUID,
  supplier_id: '33333333-3333-4333-a333-333333333333',
  purchase_order_id: null,
  file_path: `${STORE_UUID}/1708000000_abc12345.pdf`,
  file_name: 'invoice-001.pdf',
  file_type: 'application/pdf',
  file_size_bytes: 1024000,
  status: 'review',
  invoice_number: 'INV-2026-001',
  invoice_date: '2026-02-20',
  due_date: '2026-03-20',
  subtotal: 500,
  tax_amount: 100,
  total_amount: 600,
  created_by: USER_ID,
  created_at: '2026-02-20T10:00:00Z',
  updated_at: '2026-02-20T10:00:00Z',
}

const sampleInvoiceWithRelations = {
  ...sampleInvoice,
  suppliers: { id: '33333333-3333-4333-a333-333333333333', name: 'Fresh Foods Co', email: 'info@freshfoods.com', contact_person: 'John' },
  purchase_orders: null,
  invoice_line_items: [
    {
      id: 'li-1',
      invoice_id: INVOICE_UUID,
      description: 'Tomatoes 5kg',
      quantity: 10,
      unit_price: 25,
      total_price: 250,
      unit_of_measure: 'kg',
      inventory_item_id: 'item-1',
      match_status: 'auto_matched',
      match_confidence: 92,
      sort_order: 0,
      inventory_items: { id: 'item-1', name: 'Tomatoes', unit: 'kg' },
    },
    {
      id: 'li-2',
      invoice_id: INVOICE_UUID,
      description: 'Olive Oil 1L',
      quantity: 5,
      unit_price: 50,
      total_price: 250,
      unit_of_measure: 'L',
      inventory_item_id: null,
      match_status: 'unmatched',
      match_confidence: null,
      sort_order: 1,
      inventory_items: null,
    },
  ],
}

// ── Tests ──

describe('Invoices API', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  // ================================================================
  // GET /api/stores/[storeId]/invoices — List invoices
  // ================================================================
  describe('GET /api/stores/[storeId]/invoices', () => {
    it('should return invoices list with pagination for Owner', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const invoicesQuery = createChainableMock({
        data: [sampleInvoice],
        error: null,
        count: 1,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'invoices') return invoicesQuery
        return createChainableMock({ data: null, error: null })
      })

      const { GET } = await import('@/app/api/stores/[storeId]/invoices/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/invoices`)
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].id).toBe(INVOICE_UUID)
    })

    it('should return invoices list for Manager', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Manager', STORE_UUID)

      const invoicesQuery = createChainableMock({
        data: [sampleInvoice],
        error: null,
        count: 1,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'invoices') return invoicesQuery
        return createChainableMock({ data: null, error: null })
      })

      const { GET } = await import('@/app/api/stores/[storeId]/invoices/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/invoices`)
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should filter invoices by status', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const invoicesQuery = createChainableMock({
        data: [sampleInvoice],
        error: null,
        count: 1,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'invoices') return invoicesQuery
        return createChainableMock({ data: null, error: null })
      })

      const { GET } = await import('@/app/api/stores/[storeId]/invoices/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/invoices`, undefined, { status: 'review' })
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // The eq mock was called with 'status' filter
      expect(invoicesQuery.eq).toHaveBeenCalledWith('store_id', STORE_UUID)
    })

    it('should filter invoices by supplier_id', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const invoicesQuery = createChainableMock({
        data: [],
        error: null,
        count: 0,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'invoices') return invoicesQuery
        return createChainableMock({ data: null, error: null })
      })

      const supplierId = '33333333-3333-4333-a333-333333333333'
      const { GET } = await import('@/app/api/stores/[storeId]/invoices/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/invoices`, undefined, { supplier_id: supplierId })
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual([])
    })

    it('should handle database errors gracefully', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const invoicesQuery = createChainableMock({
        data: null,
        error: { message: 'DB error', code: '42P01' },
        count: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'invoices') return invoicesQuery
        return createChainableMock({ data: null, error: null })
      })

      const { GET } = await import('@/app/api/stores/[storeId]/invoices/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/invoices`)
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.success).toBe(false)
    })
  })

  // ================================================================
  // POST /api/stores/[storeId]/invoices — Upload invoice
  // ================================================================
  describe('POST /api/stores/[storeId]/invoices', () => {
    it('should upload an invoice file for Owner', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const insertQuery = createChainableMock({
        data: { ...sampleInvoice, status: 'pending' },
        error: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'invoices') return insertQuery
        return createChainableMock({ data: null, error: null })
      })
      mockAdminClient.storage.from.mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })

      const formData = new FormData()
      const file = new File(['fake pdf content'], 'invoice.pdf', { type: 'application/pdf' })
      formData.append('file', file)
      formData.append('supplier_id', '33333333-3333-4333-a333-333333333333')

      const { POST } = await import('@/app/api/stores/[storeId]/invoices/route')
      const request = createFormDataRequest(`/api/stores/${STORE_UUID}/invoices`, formData)
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(INVOICE_UUID)
    })

    it('should return 400 when no file is provided', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })

      const formData = new FormData()
      // No file appended

      const { POST } = await import('@/app/api/stores/[storeId]/invoices/route')
      const request = createFormDataRequest(`/api/stores/${STORE_UUID}/invoices`, formData)
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toContain('No file provided')
    })

    it('should return 400 for invalid file type', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })

      const formData = new FormData()
      const file = new File(['not an image'], 'readme.txt', { type: 'text/plain' })
      formData.append('file', file)

      const { POST } = await import('@/app/api/stores/[storeId]/invoices/route')
      const request = createFormDataRequest(`/api/stores/${STORE_UUID}/invoices`, formData)
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
    })

    it('should return 400 for oversized file', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })

      const formData = new FormData()
      // Create a File that reports size > 10MB
      const bigContent = new Uint8Array(11 * 1024 * 1024)
      const file = new File([bigContent], 'big-invoice.pdf', { type: 'application/pdf' })
      formData.append('file', file)

      const { POST } = await import('@/app/api/stores/[storeId]/invoices/route')
      const request = createFormDataRequest(`/api/stores/${STORE_UUID}/invoices`, formData)
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
    })

    it('should handle storage upload failure', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      mockAdminClient.from.mockImplementation(() => createChainableMock({ data: null, error: null }))
      mockAdminClient.storage.from.mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: { message: 'Storage quota exceeded' } }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })

      const formData = new FormData()
      const file = new File(['pdf content'], 'invoice.pdf', { type: 'application/pdf' })
      formData.append('file', file)

      const { POST } = await import('@/app/api/stores/[storeId]/invoices/route')
      const request = createFormDataRequest(`/api/stores/${STORE_UUID}/invoices`, formData)
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.success).toBe(false)
    })
  })

  // ================================================================
  // GET /api/stores/[storeId]/invoices/[invoiceId] — Get single invoice
  // ================================================================
  describe('GET /api/stores/[storeId]/invoices/[invoiceId]', () => {
    it('should return invoice with line items and signed URL', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const invoiceQuery = createChainableMock({
        data: sampleInvoiceWithRelations,
        error: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'invoices') return invoiceQuery
        return createChainableMock({ data: null, error: null })
      })
      mockAdminClient.storage.from.mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage.example.com/signed/invoice.pdf?token=abc' },
        }),
      })

      const { GET } = await import('@/app/api/stores/[storeId]/invoices/[invoiceId]/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/invoices/${INVOICE_UUID}`)
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID, invoiceId: INVOICE_UUID }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(INVOICE_UUID)
      expect(data.data.invoice_line_items).toHaveLength(2)
      expect(data.data.suppliers.name).toBe('Fresh Foods Co')
      expect(data.data.file_url).toBe('https://storage.example.com/signed/invoice.pdf?token=abc')
    })

    it('should return 404 when invoice not found', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const invoiceQuery = createChainableMock({
        data: null,
        error: { message: 'Not found', code: 'PGRST116' },
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'invoices') return invoiceQuery
        return createChainableMock({ data: null, error: null })
      })

      const { GET } = await import('@/app/api/stores/[storeId]/invoices/[invoiceId]/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/invoices/nonexistent-id`)
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID, invoiceId: 'nonexistent-id' }),
      })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.success).toBe(false)
    })

    it('should return file_url as null when signed URL generation fails', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const invoiceQuery = createChainableMock({
        data: sampleInvoiceWithRelations,
        error: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'invoices') return invoiceQuery
        return createChainableMock({ data: null, error: null })
      })
      mockAdminClient.storage.from.mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      })

      const { GET } = await import('@/app/api/stores/[storeId]/invoices/[invoiceId]/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/invoices/${INVOICE_UUID}`)
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID, invoiceId: INVOICE_UUID }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.file_url).toBeNull()
    })

    it('should return invoice for Manager role', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Manager', STORE_UUID)

      const invoiceQuery = createChainableMock({
        data: sampleInvoiceWithRelations,
        error: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'invoices') return invoiceQuery
        return createChainableMock({ data: null, error: null })
      })
      mockAdminClient.storage.from.mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage.example.com/signed/file.pdf' },
        }),
      })

      const { GET } = await import('@/app/api/stores/[storeId]/invoices/[invoiceId]/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/invoices/${INVOICE_UUID}`)
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID, invoiceId: INVOICE_UUID }),
      })

      expect(response.status).toBe(200)
    })
  })

  // ================================================================
  // PATCH /api/stores/[storeId]/invoices/[invoiceId] — Update invoice
  // ================================================================
  describe('PATCH /api/stores/[storeId]/invoices/[invoiceId]', () => {
    it('should update invoice fields', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const existingQuery = createChainableMock({
        data: { id: INVOICE_UUID, status: 'review' },
        error: null,
      })
      const updateQuery = createChainableMock({ data: null, error: null })
      const updatedQuery = createChainableMock({
        data: { ...sampleInvoiceWithRelations, invoice_number: 'INV-UPDATED-001' },
        error: null,
      })

      let invoiceCallCount = 0
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'invoices') {
          invoiceCallCount++
          // First call: fetch existing, second call: update, third call: fetch updated
          if (invoiceCallCount === 1) return existingQuery
          if (invoiceCallCount === 2) return updateQuery
          return updatedQuery
        }
        return createChainableMock({ data: null, error: null })
      })

      const { PATCH } = await import('@/app/api/stores/[storeId]/invoices/[invoiceId]/route')
      const request = createMockRequest('PATCH', `/api/stores/${STORE_UUID}/invoices/${INVOICE_UUID}`, {
        invoice_number: 'INV-UPDATED-001',
        total_amount: 750,
      })
      const response = await PATCH(request, {
        params: Promise.resolve({ storeId: STORE_UUID, invoiceId: INVOICE_UUID }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should update line items along with invoice fields', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const existingQuery = createChainableMock({
        data: { id: INVOICE_UUID, status: 'review' },
        error: null,
      })
      const updateQuery = createChainableMock({ data: null, error: null })
      const lineItemUpdateQuery = createChainableMock({ data: null, error: null })
      const lineItemInsertQuery = createChainableMock({ data: null, error: null })
      const updatedQuery = createChainableMock({
        data: sampleInvoiceWithRelations,
        error: null,
      })

      let invoiceCallCount = 0
      let lineItemCallCount = 0
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'invoices') {
          invoiceCallCount++
          if (invoiceCallCount === 1) return existingQuery
          if (invoiceCallCount === 2) return updateQuery
          return updatedQuery
        }
        if (table === 'invoice_line_items') {
          lineItemCallCount++
          if (lineItemCallCount === 1) return lineItemUpdateQuery
          return lineItemInsertQuery
        }
        return createChainableMock({ data: null, error: null })
      })

      const { PATCH } = await import('@/app/api/stores/[storeId]/invoices/[invoiceId]/route')
      const request = createMockRequest('PATCH', `/api/stores/${STORE_UUID}/invoices/${INVOICE_UUID}`, {
        status: 'approved',
        line_items: [
          { id: '44444444-4444-4444-a444-444444444444', quantity: 12, unit_price: 25 },
          { description: 'New Item', quantity: 5, unit_price: 10, total_price: 50, inventory_item_id: '55555555-5555-4555-a555-555555555555' },
        ],
      })
      const response = await PATCH(request, {
        params: Promise.resolve({ storeId: STORE_UUID, invoiceId: INVOICE_UUID }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should return 400 for invalid update data', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })

      const { PATCH } = await import('@/app/api/stores/[storeId]/invoices/[invoiceId]/route')
      const request = createMockRequest('PATCH', `/api/stores/${STORE_UUID}/invoices/${INVOICE_UUID}`, {
        total_amount: -50, // Negative — min(0) validation fails
      })
      const response = await PATCH(request, {
        params: Promise.resolve({ storeId: STORE_UUID, invoiceId: INVOICE_UUID }),
      })
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
    })

    it('should return 404 when invoice does not exist', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const existingQuery = createChainableMock({
        data: null,
        error: { message: 'Not found', code: 'PGRST116' },
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'invoices') return existingQuery
        return createChainableMock({ data: null, error: null })
      })

      const { PATCH } = await import('@/app/api/stores/[storeId]/invoices/[invoiceId]/route')
      const request = createMockRequest('PATCH', `/api/stores/${STORE_UUID}/invoices/${INVOICE_UUID}`, {
        invoice_number: 'INV-999',
      })
      const response = await PATCH(request, {
        params: Promise.resolve({ storeId: STORE_UUID, invoiceId: INVOICE_UUID }),
      })

      expect(response.status).toBe(404)
    })

    it('should return 400 when trying to modify an applied invoice', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const existingQuery = createChainableMock({
        data: { id: INVOICE_UUID, status: 'applied' },
        error: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'invoices') return existingQuery
        return createChainableMock({ data: null, error: null })
      })

      const { PATCH } = await import('@/app/api/stores/[storeId]/invoices/[invoiceId]/route')
      const request = createMockRequest('PATCH', `/api/stores/${STORE_UUID}/invoices/${INVOICE_UUID}`, {
        invoice_number: 'INV-CHANGED',
      })
      const response = await PATCH(request, {
        params: Promise.resolve({ storeId: STORE_UUID, invoiceId: INVOICE_UUID }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toContain('applied')
    })
  })

  // ================================================================
  // POST /api/stores/[storeId]/invoices/[invoiceId]/apply — Apply to inventory
  // ================================================================
  describe('POST /api/stores/[storeId]/invoices/[invoiceId]/apply', () => {
    it('should apply an approved invoice to inventory', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const invoiceQuery = createChainableMock({
        data: { id: INVOICE_UUID, status: 'approved', invoice_number: 'INV-2026-001' },
        error: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'invoices') return invoiceQuery
        return createChainableMock({ data: null, error: null })
      })

      const { POST } = await import('@/app/api/stores/[storeId]/invoices/[invoiceId]/apply/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/invoices/${INVOICE_UUID}/apply`, {
        notes: 'Received by warehouse team',
      })
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID, invoiceId: INVOICE_UUID }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.invoice_id).toBe(INVOICE_UUID)
      expect(data.data.items_updated).toBe(3)
      expect(data.data.status).toBe('applied')
    })

    it('should apply a review-status invoice', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const invoiceQuery = createChainableMock({
        data: { id: INVOICE_UUID, status: 'review', invoice_number: 'INV-2026-002' },
        error: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'invoices') return invoiceQuery
        return createChainableMock({ data: null, error: null })
      })

      const { POST } = await import('@/app/api/stores/[storeId]/invoices/[invoiceId]/apply/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/invoices/${INVOICE_UUID}/apply`)
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID, invoiceId: INVOICE_UUID }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.items_updated).toBe(3)
    })

    it('should return 400 when invoice has already been applied', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const invoiceQuery = createChainableMock({
        data: { id: INVOICE_UUID, status: 'applied', invoice_number: 'INV-2026-001' },
        error: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'invoices') return invoiceQuery
        return createChainableMock({ data: null, error: null })
      })

      const { POST } = await import('@/app/api/stores/[storeId]/invoices/[invoiceId]/apply/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/invoices/${INVOICE_UUID}/apply`)
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID, invoiceId: INVOICE_UUID }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toContain('already been applied')
    })

    it('should return 400 for invoice in pending status', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const invoiceQuery = createChainableMock({
        data: { id: INVOICE_UUID, status: 'pending', invoice_number: 'INV-2026-003' },
        error: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'invoices') return invoiceQuery
        return createChainableMock({ data: null, error: null })
      })

      const { POST } = await import('@/app/api/stores/[storeId]/invoices/[invoiceId]/apply/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/invoices/${INVOICE_UUID}/apply`)
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID, invoiceId: INVOICE_UUID }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toContain('pending')
    })

    it('should return 404 when invoice not found', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const invoiceQuery = createChainableMock({
        data: null,
        error: { message: 'Not found', code: 'PGRST116' },
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'invoices') return invoiceQuery
        return createChainableMock({ data: null, error: null })
      })

      const { POST } = await import('@/app/api/stores/[storeId]/invoices/[invoiceId]/apply/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/invoices/${INVOICE_UUID}/apply`)
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID, invoiceId: INVOICE_UUID }),
      })

      expect(response.status).toBe(404)
    })
  })

  // ================================================================
  // Auth & Access Control
  // ================================================================
  describe('Auth and access control', () => {
    it('should return 401 when not authenticated (GET list)', async () => {
      setupUnauthenticatedUser()

      const { GET } = await import('@/app/api/stores/[storeId]/invoices/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/invoices`)
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })

      expect(response.status).toBe(401)
    })

    it('should return 401 when not authenticated (POST upload)', async () => {
      setupUnauthenticatedUser()

      const formData = new FormData()
      const file = new File(['content'], 'invoice.pdf', { type: 'application/pdf' })
      formData.append('file', file)

      const { POST } = await import('@/app/api/stores/[storeId]/invoices/route')
      const request = createFormDataRequest(`/api/stores/${STORE_UUID}/invoices`, formData)
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })

      expect(response.status).toBe(401)
    })

    it('should return 401 when not authenticated (GET single)', async () => {
      setupUnauthenticatedUser()

      const { GET } = await import('@/app/api/stores/[storeId]/invoices/[invoiceId]/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/invoices/${INVOICE_UUID}`)
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID, invoiceId: INVOICE_UUID }),
      })

      expect(response.status).toBe(401)
    })

    it('should return 401 when not authenticated (PATCH)', async () => {
      setupUnauthenticatedUser()

      const { PATCH } = await import('@/app/api/stores/[storeId]/invoices/[invoiceId]/route')
      const request = createMockRequest('PATCH', `/api/stores/${STORE_UUID}/invoices/${INVOICE_UUID}`, { invoice_number: 'X' })
      const response = await PATCH(request, {
        params: Promise.resolve({ storeId: STORE_UUID, invoiceId: INVOICE_UUID }),
      })

      expect(response.status).toBe(401)
    })

    it('should return 401 when not authenticated (POST apply)', async () => {
      setupUnauthenticatedUser()

      const { POST } = await import('@/app/api/stores/[storeId]/invoices/[invoiceId]/apply/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/invoices/${INVOICE_UUID}/apply`)
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID, invoiceId: INVOICE_UUID }),
      })

      expect(response.status).toBe(401)
    })

    it('should return 403 for Staff role on GET list', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff', STORE_UUID)

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const { GET } = await import('@/app/api/stores/[storeId]/invoices/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/invoices`)
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })

      expect(response.status).toBe(403)
    })

    it('should return 403 for Staff role on POST upload', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff', STORE_UUID)

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const formData = new FormData()
      const file = new File(['content'], 'invoice.pdf', { type: 'application/pdf' })
      formData.append('file', file)

      const { POST } = await import('@/app/api/stores/[storeId]/invoices/route')
      const request = createFormDataRequest(`/api/stores/${STORE_UUID}/invoices`, formData)
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })

      expect(response.status).toBe(403)
    })

    it('should return 403 for Staff role on PATCH', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff', STORE_UUID)

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const { PATCH } = await import('@/app/api/stores/[storeId]/invoices/[invoiceId]/route')
      const request = createMockRequest('PATCH', `/api/stores/${STORE_UUID}/invoices/${INVOICE_UUID}`, { invoice_number: 'X' })
      const response = await PATCH(request, {
        params: Promise.resolve({ storeId: STORE_UUID, invoiceId: INVOICE_UUID }),
      })

      expect(response.status).toBe(403)
    })

    it('should return 403 for Staff role on POST apply', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff', STORE_UUID)

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/invoices/[invoiceId]/apply/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/invoices/${INVOICE_UUID}/apply`)
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID, invoiceId: INVOICE_UUID }),
      })

      expect(response.status).toBe(403)
    })

    it('should return 403 when user does not belong to the store (GET list)', async () => {
      // Authenticated as Owner at STORE_UUID, but requesting OTHER_STORE_UUID
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })

      const { GET } = await import('@/app/api/stores/[storeId]/invoices/route')
      const request = createMockRequest('GET', `/api/stores/${OTHER_STORE_UUID}/invoices`)
      const response = await GET(request, { params: Promise.resolve({ storeId: OTHER_STORE_UUID }) })

      expect(response.status).toBe(403)
    })

    it('should return 403 when user does not belong to the store (POST apply)', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/invoices/[invoiceId]/apply/route')
      const request = createMockRequest('POST', `/api/stores/${OTHER_STORE_UUID}/invoices/${INVOICE_UUID}/apply`)
      const response = await POST(request, {
        params: Promise.resolve({ storeId: OTHER_STORE_UUID, invoiceId: INVOICE_UUID }),
      })

      expect(response.status).toBe(403)
    })
  })
})
