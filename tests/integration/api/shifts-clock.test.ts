import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

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
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    single: vi.fn(),
  })),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
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

// Helper to create mock NextRequest
function createMockRequest(): NextRequest {
  const url = new URL('http://localhost:3000/api/shifts/shift-1/clock-in')

  return {
    method: 'POST',
    nextUrl: url,
    url: url.toString(),
    json: vi.fn(() => Promise.resolve({})),
    headers: new Headers(),
  } as unknown as NextRequest
}

// Helper to setup authenticated user with specific role
function setupAuthenticatedUser(role: string, stores: object[] = []) {
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
        store_id: 'store-1',
        user_id: 'user-123',
        role,
        is_billing_owner: role === 'Owner',
        store: { id: 'store-1', name: 'Test Store', is_active: true },
      },
    ],
    error: null,
  })

  return { profileQuery, storeUsersQuery }
}

describe('Shifts Clock-in/Clock-out API Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset timers to use real time
    vi.useRealTimers()
  })

  describe('POST /api/shifts/:shiftId/clock-in', () => {
    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        })

        const { POST } = await import('@/app/api/shifts/[shiftId]/clock-in/route')

        const request = createMockRequest()
        const response = await POST(request, { params: Promise.resolve({ shiftId: 'shift-1' }) })
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.success).toBe(false)
        expect(data.code).toBe('UNAUTHORIZED')
      })
    })

    describe('Shift Not Found', () => {
      it('should return 404 when shift does not exist', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        const shiftQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' },
          }),
        }

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'shifts') return shiftQuery
          return shiftQuery
        })

        const { POST } = await import('@/app/api/shifts/[shiftId]/clock-in/route')

        const request = createMockRequest()
        const response = await POST(request, { params: Promise.resolve({ shiftId: 'nonexistent' }) })
        const data = await response.json()

        expect(response.status).toBe(404)
        expect(data.code).toBe('NOT_FOUND')
      })
    })

    describe('Authorization', () => {
      it('should return 403 when user tries to clock in to another users shift', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        // Shift belongs to different user
        const shiftQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'shift-1',
              store_id: 'store-1',
              user_id: 'other-user-456', // Different user
              start_time: new Date().toISOString(),
              end_time: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
              clock_in_time: null,
            },
            error: null,
          }),
        }

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'shifts') return shiftQuery
          return shiftQuery
        })

        const { POST } = await import('@/app/api/shifts/[shiftId]/clock-in/route')

        const request = createMockRequest()
        const response = await POST(request, { params: Promise.resolve({ shiftId: 'shift-1' }) })
        const data = await response.json()

        expect(response.status).toBe(403)
        expect(data.message).toContain('your own shifts')
      })

      it('should allow Manager to clock in for staff at their store', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Manager')

        const shiftStart = new Date()

        // Track calls to return different responses for fetch vs update
        let singleCallCount = 0
        const shiftQuery = {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockImplementation(() => {
            singleCallCount++
            if (singleCallCount === 1) {
              // First call: fetch the shift
              return Promise.resolve({
                data: {
                  id: 'shift-1',
                  store_id: 'store-1',
                  user_id: 'other-user-456', // Different user but manager can clock them in
                  start_time: shiftStart.toISOString(),
                  end_time: new Date(shiftStart.getTime() + 8 * 60 * 60 * 1000).toISOString(),
                  clock_in_time: null,
                },
                error: null,
              })
            } else {
              // Second call: update result
              return Promise.resolve({
                data: {
                  id: 'shift-1',
                  store_id: 'store-1',
                  user_id: 'other-user-456',
                  clock_in_time: new Date().toISOString(),
                },
                error: null,
              })
            }
          }),
        }

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'shifts') return shiftQuery
          return shiftQuery
        })

        const { POST } = await import('@/app/api/shifts/[shiftId]/clock-in/route')

        const request = createMockRequest()
        const response = await POST(request, { params: Promise.resolve({ shiftId: 'shift-1' }) })
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
      })
    })

    describe('Already Clocked In', () => {
      it('should return 400 if already clocked in', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        // Shift already has clock_in_time
        const shiftQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'shift-1',
              store_id: 'store-1',
              user_id: 'user-123',
              start_time: new Date().toISOString(),
              end_time: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
              clock_in_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // Already clocked in
            },
            error: null,
          }),
        }

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'shifts') return shiftQuery
          return shiftQuery
        })

        const { POST } = await import('@/app/api/shifts/[shiftId]/clock-in/route')

        const request = createMockRequest()
        const response = await POST(request, { params: Promise.resolve({ shiftId: 'shift-1' }) })
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.message).toContain('Already clocked in')
      })
    })

    describe('Too Early', () => {
      it('should return 400 if trying to clock in more than 15 minutes early', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        // Shift starts 30 minutes from now
        const shiftStart = new Date(Date.now() + 30 * 60 * 1000)
        const shiftQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'shift-1',
              store_id: 'store-1',
              user_id: 'user-123',
              start_time: shiftStart.toISOString(),
              end_time: new Date(shiftStart.getTime() + 8 * 60 * 60 * 1000).toISOString(),
              clock_in_time: null,
            },
            error: null,
          }),
        }

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'shifts') return shiftQuery
          return shiftQuery
        })

        const { POST } = await import('@/app/api/shifts/[shiftId]/clock-in/route')

        const request = createMockRequest()
        const response = await POST(request, { params: Promise.resolve({ shiftId: 'shift-1' }) })
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.message).toContain('Too early')
      })
    })

    describe('Successful Clock In', () => {
      it('should clock in successfully when within 15 minutes before shift', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        // Shift starts 10 minutes from now (within 15 min window)
        const shiftStart = new Date(Date.now() + 10 * 60 * 1000)

        // Track calls to return different responses for fetch vs update
        let singleCallCount = 0
        const shiftQuery = {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockImplementation(() => {
            singleCallCount++
            if (singleCallCount === 1) {
              // First call: fetch the shift
              return Promise.resolve({
                data: {
                  id: 'shift-1',
                  store_id: 'store-1',
                  user_id: 'user-123',
                  start_time: shiftStart.toISOString(),
                  end_time: new Date(shiftStart.getTime() + 8 * 60 * 60 * 1000).toISOString(),
                  clock_in_time: null,
                },
                error: null,
              })
            } else {
              // Second call: update result
              return Promise.resolve({
                data: {
                  id: 'shift-1',
                  store_id: 'store-1',
                  user_id: 'user-123',
                  clock_in_time: new Date().toISOString(),
                  store: { id: 'store-1', name: 'Test Store' },
                  user: { id: 'user-123', full_name: 'Test User' },
                },
                error: null,
              })
            }
          }),
        }

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'shifts') return shiftQuery
          return shiftQuery
        })

        const { POST } = await import('@/app/api/shifts/[shiftId]/clock-in/route')

        const request = createMockRequest()
        const response = await POST(request, { params: Promise.resolve({ shiftId: 'shift-1' }) })
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.clock_in_time).toBeDefined()
      })

      it('should clock in successfully when shift has already started', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        // Shift started 30 minutes ago
        const shiftStart = new Date(Date.now() - 30 * 60 * 1000)

        // Track calls to return different responses for fetch vs update
        let singleCallCount = 0
        const shiftQuery = {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockImplementation(() => {
            singleCallCount++
            if (singleCallCount === 1) {
              // First call: fetch the shift
              return Promise.resolve({
                data: {
                  id: 'shift-1',
                  store_id: 'store-1',
                  user_id: 'user-123',
                  start_time: shiftStart.toISOString(),
                  end_time: new Date(shiftStart.getTime() + 8 * 60 * 60 * 1000).toISOString(),
                  clock_in_time: null,
                },
                error: null,
              })
            } else {
              // Second call: update result
              return Promise.resolve({
                data: {
                  id: 'shift-1',
                  store_id: 'store-1',
                  user_id: 'user-123',
                  clock_in_time: new Date().toISOString(),
                },
                error: null,
              })
            }
          }),
        }

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'shifts') return shiftQuery
          return shiftQuery
        })

        const { POST } = await import('@/app/api/shifts/[shiftId]/clock-in/route')

        const request = createMockRequest()
        const response = await POST(request, { params: Promise.resolve({ shiftId: 'shift-1' }) })
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
      })
    })

    describe('Race Condition Prevention', () => {
      it('should handle race condition when already clocked in', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        const shiftStart = new Date()

        // Track calls to return different responses for fetch vs update
        let singleCallCount = 0
        const shiftQuery = {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockImplementation(() => {
            singleCallCount++
            if (singleCallCount === 1) {
              // First call: fetch the shift (appears not clocked in yet)
              return Promise.resolve({
                data: {
                  id: 'shift-1',
                  store_id: 'store-1',
                  user_id: 'user-123',
                  start_time: shiftStart.toISOString(),
                  end_time: new Date(shiftStart.getTime() + 8 * 60 * 60 * 1000).toISOString(),
                  clock_in_time: null,
                },
                error: null,
              })
            } else {
              // Second call: update fails - no rows matched (race condition)
              return Promise.resolve({
                data: null,
                error: { code: 'PGRST116' },
              })
            }
          }),
        }

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'shifts') return shiftQuery
          return shiftQuery
        })

        const { POST } = await import('@/app/api/shifts/[shiftId]/clock-in/route')

        const request = createMockRequest()
        const response = await POST(request, { params: Promise.resolve({ shiftId: 'shift-1' }) })
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.message).toContain('Already clocked in')
      })
    })
  })
})
