import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Create chainable query builder mock
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

// Mock Supabase client
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

describe('HACCP Templates API', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  const STORE_UUID = '11111111-1111-4111-a111-111111111111'
  const TEMPLATE_UUID = '22222222-2222-4222-a222-222222222222'

  const validTemplateBody = {
    name: 'Opening Check',
    description: 'Daily opening food safety check',
    frequency: 'daily',
    items: [
      { id: '1', label: 'Fridge temperature OK?', type: 'yes_no', required: true },
      { id: '2', label: 'Hand wash station stocked?', type: 'yes_no', required: true },
    ],
  }

  describe('GET /api/stores/[storeId]/haccp/templates', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
      const { GET } = await import('@/app/api/stores/[storeId]/haccp/templates/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/haccp/templates`)
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      expect(response.status).toBe(401)
    })

    it('should return templates list for authenticated user', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const templatesQuery = createChainableMock({
        data: [
          {
            id: TEMPLATE_UUID,
            store_id: STORE_UUID,
            name: 'Opening Check',
            description: 'Daily opening food safety check',
            frequency: 'daily',
            items: validTemplateBody.items,
            is_active: true,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
        error: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'haccp_check_templates') return templatesQuery
        return storeUsersQuery
      })

      const { GET } = await import('@/app/api/stores/[storeId]/haccp/templates/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/haccp/templates`)
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].name).toBe('Opening Check')
    })

    it('should filter active_only templates', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const templatesQuery = createChainableMock({
        data: [
          {
            id: TEMPLATE_UUID,
            store_id: STORE_UUID,
            name: 'Opening Check',
            is_active: true,
          },
        ],
        error: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'haccp_check_templates') return templatesQuery
        return storeUsersQuery
      })

      const { GET } = await import('@/app/api/stores/[storeId]/haccp/templates/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/haccp/templates`, undefined, { active_only: 'true' })
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].is_active).toBe(true)
    })
  })

  describe('POST /api/stores/[storeId]/haccp/templates', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
      const { POST } = await import('@/app/api/stores/[storeId]/haccp/templates/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/haccp/templates`, validTemplateBody)
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      expect(response.status).toBe(401)
    })

    it('should return 403 for Staff role', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff', STORE_UUID)
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })
      const { POST } = await import('@/app/api/stores/[storeId]/haccp/templates/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/haccp/templates`, validTemplateBody)
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      expect(response.status).toBe(403)
    })

    it('should return 400 for invalid data - missing name', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      const { POST } = await import('@/app/api/stores/[storeId]/haccp/templates/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/haccp/templates`, {
        description: 'Missing name field',
        frequency: 'daily',
        items: validTemplateBody.items,
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      expect(response.status).toBe(400)
    })

    it('should return 400 for invalid data - empty items', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return storeUsersQuery
      })
      const { POST } = await import('@/app/api/stores/[storeId]/haccp/templates/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/haccp/templates`, {
        name: 'Opening Check',
        description: 'Daily opening food safety check',
        frequency: 'daily',
        items: [],
      })
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      expect(response.status).toBe(400)
    })

    it('should create template successfully for Owner', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const insertQuery = createChainableMock({
        data: {
          id: TEMPLATE_UUID,
          store_id: STORE_UUID,
          name: 'Opening Check',
          description: 'Daily opening food safety check',
          frequency: 'daily',
          items: validTemplateBody.items,
          is_active: true,
          created_by: 'user-123',
          created_at: '2026-01-01T00:00:00Z',
        },
        error: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'haccp_check_templates') return insertQuery
        return storeUsersQuery
      })

      const { POST } = await import('@/app/api/stores/[storeId]/haccp/templates/route')
      const request = createMockRequest('POST', `/api/stores/${STORE_UUID}/haccp/templates`, validTemplateBody)
      const response = await POST(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('Opening Check')
      expect(data.data.items).toHaveLength(2)
    })
  })

  describe('GET /api/stores/[storeId]/haccp/templates/[templateId]', () => {
    it('should return 404 for non-existent template', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const templateQuery = createChainableMock({
        data: null,
        error: { message: 'Not found', code: 'PGRST116' },
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'haccp_check_templates') return templateQuery
        return storeUsersQuery
      })

      const { GET } = await import('@/app/api/stores/[storeId]/haccp/templates/[templateId]/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/haccp/templates/${TEMPLATE_UUID}`)
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID, templateId: TEMPLATE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.code).toBe('NOT_FOUND')
    })

    it('should return template for valid ID', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const templateQuery = createChainableMock({
        data: {
          id: TEMPLATE_UUID,
          store_id: STORE_UUID,
          name: 'Opening Check',
          description: 'Daily opening food safety check',
          frequency: 'daily',
          items: validTemplateBody.items,
          is_active: true,
          created_by: 'user-123',
          created_at: '2026-01-01T00:00:00Z',
        },
        error: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'haccp_check_templates') return templateQuery
        return storeUsersQuery
      })

      const { GET } = await import('@/app/api/stores/[storeId]/haccp/templates/[templateId]/route')
      const request = createMockRequest('GET', `/api/stores/${STORE_UUID}/haccp/templates/${TEMPLATE_UUID}`)
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID, templateId: TEMPLATE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(TEMPLATE_UUID)
      expect(data.data.name).toBe('Opening Check')
      expect(data.data.items).toHaveLength(2)
    })
  })

  describe('PUT /api/stores/[storeId]/haccp/templates/[templateId]', () => {
    it('should return 403 for Staff', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff', STORE_UUID)
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        return profileQuery
      })
      const { PUT } = await import('@/app/api/stores/[storeId]/haccp/templates/[templateId]/route')
      const request = createMockRequest('PUT', `/api/stores/${STORE_UUID}/haccp/templates/${TEMPLATE_UUID}`, {
        name: 'Updated Check',
      })
      const response = await PUT(request, { params: Promise.resolve({ storeId: STORE_UUID, templateId: TEMPLATE_UUID }) })
      expect(response.status).toBe(403)
    })

    it('should update template successfully', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const updateQuery = createChainableMock({
        data: {
          id: TEMPLATE_UUID,
          store_id: STORE_UUID,
          name: 'Updated Opening Check',
          description: 'Updated daily opening food safety check',
          frequency: 'daily',
          items: [
            { id: '1', label: 'Fridge temperature OK?', type: 'yes_no', required: true },
            { id: '2', label: 'Hand wash station stocked?', type: 'yes_no', required: true },
            { id: '3', label: 'Sanitiser available?', type: 'yes_no', required: false },
          ],
          is_active: true,
          updated_at: '2026-01-02T00:00:00Z',
        },
        error: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'haccp_check_templates') return updateQuery
        return storeUsersQuery
      })

      const { PUT } = await import('@/app/api/stores/[storeId]/haccp/templates/[templateId]/route')
      const request = createMockRequest('PUT', `/api/stores/${STORE_UUID}/haccp/templates/${TEMPLATE_UUID}`, {
        name: 'Updated Opening Check',
        description: 'Updated daily opening food safety check',
        frequency: 'daily',
        items: [
          { id: '1', label: 'Fridge temperature OK?', type: 'yes_no', required: true },
          { id: '2', label: 'Hand wash station stocked?', type: 'yes_no', required: true },
          { id: '3', label: 'Sanitiser available?', type: 'yes_no', required: false },
        ],
      })
      const response = await PUT(request, { params: Promise.resolve({ storeId: STORE_UUID, templateId: TEMPLATE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('Updated Opening Check')
      expect(data.data.items).toHaveLength(3)
    })
  })

  describe('DELETE /api/stores/[storeId]/haccp/templates/[templateId]', () => {
    it('should soft delete template (set is_active=false)', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner', STORE_UUID)

      const deleteQuery = createChainableMock({
        data: {
          id: TEMPLATE_UUID,
          store_id: STORE_UUID,
          name: 'Opening Check',
          is_active: false,
          updated_at: '2026-01-02T00:00:00Z',
        },
        error: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'haccp_check_templates') return deleteQuery
        return storeUsersQuery
      })

      const { DELETE } = await import('@/app/api/stores/[storeId]/haccp/templates/[templateId]/route')
      const request = createMockRequest('DELETE', `/api/stores/${STORE_UUID}/haccp/templates/${TEMPLATE_UUID}`)
      const response = await DELETE(request, { params: Promise.resolve({ storeId: STORE_UUID, templateId: TEMPLATE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.message).toBe('HACCP template deactivated successfully')
    })
  })
})
