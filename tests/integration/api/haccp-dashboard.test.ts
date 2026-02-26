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
    } else if (method === 'range') {
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
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => createChainableMock({ error: null })),
  })),
}))

// Mock rate limit
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({
    success: true,
    remaining: 99,
    resetTime: Date.now() + 60000,
    limit: 100,
  })),
  RATE_LIMITS: {
    api: { limit: 100, windowMs: 60000 },
  },
  getRateLimitHeaders: vi.fn(() => ({})),
}))

// Mock audit log
vi.mock('@/lib/audit', () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
  computeFieldChanges: vi.fn().mockReturnValue([]),
}))

// Mock CSRF validation
vi.mock('@/lib/csrf', () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
  getCSRFToken: vi.fn().mockResolvedValue('test-csrf-token'),
}))

// Helper to create mock NextRequest
function createMockRequest(): NextRequest {
  const url = new URL(`http://localhost:3000/api/stores/${STORE_UUID}/haccp/dashboard`)

  return {
    method: 'GET',
    nextUrl: url,
    url: url.toString(),
    headers: new Headers(),
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    },
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

describe('HACCP Dashboard API Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/stores/:storeId/haccp/dashboard', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const { GET } = await import('@/app/api/stores/[storeId]/haccp/dashboard/route')

      const request = createMockRequest()
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.code).toBe('UNAUTHORIZED')
    })

    it('should return dashboard data with compliance score', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

      // Query 1: Today's checks — 3 checks, 2 pass, 1 fail
      const todayChecksQuery = createChainableMock({
        data: [
          { id: 'check-1', status: 'pass', completed_at: '2026-02-25T09:00:00Z' },
          { id: 'check-2', status: 'pass', completed_at: '2026-02-25T10:00:00Z' },
          { id: 'check-3', status: 'fail', completed_at: '2026-02-25T11:00:00Z' },
        ],
        error: null,
      })

      // Query 2: Today's out-of-range temp logs — 1 alert
      const outOfRangeTempsQuery = createChainableMock({
        data: [
          { id: 'temp-1' },
        ],
        error: null,
      })

      // Query 3: Unresolved corrective actions — 2 actions
      const unresolvedActionsQuery = createChainableMock({
        data: [
          { id: 'action-1' },
          { id: 'action-2' },
        ],
        error: null,
      })

      // Query 4: Recent 5 checks with template join
      const recentChecksQuery = createChainableMock({
        data: [
          { id: 'check-3', status: 'fail', completed_at: '2026-02-25T11:00:00Z', haccp_check_templates: { name: 'Opening Check' } },
          { id: 'check-2', status: 'pass', completed_at: '2026-02-25T10:00:00Z', haccp_check_templates: { name: 'Temp Check' } },
          { id: 'check-1', status: 'pass', completed_at: '2026-02-25T09:00:00Z', haccp_check_templates: { name: 'Delivery Check' } },
        ],
        error: null,
      })

      // Query 5: Recent 5 out-of-range temp alerts
      const recentTempAlertsQuery = createChainableMock({
        data: [
          { id: 'temp-1', equipment_name: 'Walk-in Fridge', temperature: 8.5, min_temp: 0, max_temp: 5, recorded_at: '2026-02-25T08:30:00Z', is_in_range: false },
        ],
        error: null,
      })

      // Track from() calls to return different mocks per query
      let haccpChecksCallCount = 0
      let haccpTempLogsCallCount = 0

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'haccp_checks') {
          haccpChecksCallCount++
          // First call: today's checks; Second call: recent 5 checks with template join
          return haccpChecksCallCount === 1 ? todayChecksQuery : recentChecksQuery
        }
        if (table === 'haccp_temperature_logs') {
          haccpTempLogsCallCount++
          // First call: today's out-of-range; Second call: recent 5 alerts
          return haccpTempLogsCallCount === 1 ? outOfRangeTempsQuery : recentTempAlertsQuery
        }
        if (table === 'haccp_corrective_actions') return unresolvedActionsQuery
        return createChainableMock({ data: [], error: null })
      })

      const { GET } = await import('@/app/api/stores/[storeId]/haccp/dashboard/route')

      const request = createMockRequest()
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.today.total_checks).toBe(3)
      expect(data.data.today.passed_checks).toBe(2)
      expect(data.data.today.failed_checks).toBe(1)
      expect(data.data.today.out_of_range_temps).toBe(1)
      expect(data.data.unresolved_corrective_actions).toBe(2)
      expect(data.data.compliance_score).toBe(67)
      expect(data.data.recent_checks).toHaveLength(3)
      expect(data.data.recent_temp_alerts).toHaveLength(1)
    })

    it('should return 100% compliance when no checks today', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

      // No checks today
      const todayChecksQuery = createChainableMock({
        data: [],
        error: null,
      })

      // No out-of-range temps today
      const outOfRangeTempsQuery = createChainableMock({
        data: [],
        error: null,
      })

      // No unresolved corrective actions
      const unresolvedActionsQuery = createChainableMock({
        data: [],
        error: null,
      })

      // No recent checks
      const recentChecksQuery = createChainableMock({
        data: [],
        error: null,
      })

      // No recent temp alerts
      const recentTempAlertsQuery = createChainableMock({
        data: [],
        error: null,
      })

      let haccpChecksCallCount = 0
      let haccpTempLogsCallCount = 0

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'haccp_checks') {
          haccpChecksCallCount++
          return haccpChecksCallCount === 1 ? todayChecksQuery : recentChecksQuery
        }
        if (table === 'haccp_temperature_logs') {
          haccpTempLogsCallCount++
          return haccpTempLogsCallCount === 1 ? outOfRangeTempsQuery : recentTempAlertsQuery
        }
        if (table === 'haccp_corrective_actions') return unresolvedActionsQuery
        return createChainableMock({ data: [], error: null })
      })

      const { GET } = await import('@/app/api/stores/[storeId]/haccp/dashboard/route')

      const request = createMockRequest()
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.today.total_checks).toBe(0)
      expect(data.data.today.passed_checks).toBe(0)
      expect(data.data.today.failed_checks).toBe(0)
      expect(data.data.today.out_of_range_temps).toBe(0)
      expect(data.data.compliance_score).toBe(100)
      expect(data.data.recent_checks).toHaveLength(0)
      expect(data.data.recent_temp_alerts).toHaveLength(0)
    })

    it('should include unresolved corrective actions count', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Manager')

      // Some checks today — all passing
      const todayChecksQuery = createChainableMock({
        data: [
          { id: 'check-1', status: 'pass', completed_at: '2026-02-25T09:00:00Z' },
        ],
        error: null,
      })

      // No out-of-range temps
      const outOfRangeTempsQuery = createChainableMock({
        data: [],
        error: null,
      })

      // 3 unresolved corrective actions
      const unresolvedActionsQuery = createChainableMock({
        data: [
          { id: 'action-1' },
          { id: 'action-2' },
          { id: 'action-3' },
        ],
        error: null,
      })

      // Recent checks
      const recentChecksQuery = createChainableMock({
        data: [
          { id: 'check-1', status: 'pass', completed_at: '2026-02-25T09:00:00Z', haccp_check_templates: { name: 'Opening Check' } },
        ],
        error: null,
      })

      // No recent temp alerts
      const recentTempAlertsQuery = createChainableMock({
        data: [],
        error: null,
      })

      let haccpChecksCallCount = 0
      let haccpTempLogsCallCount = 0

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'haccp_checks') {
          haccpChecksCallCount++
          return haccpChecksCallCount === 1 ? todayChecksQuery : recentChecksQuery
        }
        if (table === 'haccp_temperature_logs') {
          haccpTempLogsCallCount++
          return haccpTempLogsCallCount === 1 ? outOfRangeTempsQuery : recentTempAlertsQuery
        }
        if (table === 'haccp_corrective_actions') return unresolvedActionsQuery
        return createChainableMock({ data: [], error: null })
      })

      const { GET } = await import('@/app/api/stores/[storeId]/haccp/dashboard/route')

      const request = createMockRequest()
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.unresolved_corrective_actions).toBe(3)
      expect(data.data.compliance_score).toBe(100)
    })

    it('should allow Staff to access dashboard', async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

      // Minimal data — 1 check passing
      const todayChecksQuery = createChainableMock({
        data: [
          { id: 'check-1', status: 'pass', completed_at: '2026-02-25T12:00:00Z' },
        ],
        error: null,
      })

      const outOfRangeTempsQuery = createChainableMock({
        data: [],
        error: null,
      })

      const unresolvedActionsQuery = createChainableMock({
        data: [],
        error: null,
      })

      const recentChecksQuery = createChainableMock({
        data: [
          { id: 'check-1', status: 'pass', completed_at: '2026-02-25T12:00:00Z', haccp_check_templates: { name: 'Closing Check' } },
        ],
        error: null,
      })

      const recentTempAlertsQuery = createChainableMock({
        data: [],
        error: null,
      })

      let haccpChecksCallCount = 0
      let haccpTempLogsCallCount = 0

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'store_users') return storeUsersQuery
        if (table === 'haccp_checks') {
          haccpChecksCallCount++
          return haccpChecksCallCount === 1 ? todayChecksQuery : recentChecksQuery
        }
        if (table === 'haccp_temperature_logs') {
          haccpTempLogsCallCount++
          return haccpTempLogsCallCount === 1 ? outOfRangeTempsQuery : recentTempAlertsQuery
        }
        if (table === 'haccp_corrective_actions') return unresolvedActionsQuery
        return createChainableMock({ data: [], error: null })
      })

      const { GET } = await import('@/app/api/stores/[storeId]/haccp/dashboard/route')

      const request = createMockRequest()
      const response = await GET(request, { params: Promise.resolve({ storeId: STORE_UUID }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.today.total_checks).toBe(1)
      expect(data.data.today.passed_checks).toBe(1)
      expect(data.data.today.failed_checks).toBe(0)
      expect(data.data.compliance_score).toBe(100)
    })
  })
})
