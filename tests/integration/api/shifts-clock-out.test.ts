import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

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

// Mock CSRF validation
vi.mock('@/lib/csrf', () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
  getCSRFToken: vi.fn().mockResolvedValue('test-csrf-token'),
}))

// Helper to create mock NextRequest
function createMockRequest(): NextRequest {
  const url = new URL('http://localhost:3000/api/shifts/shift-123/clock-out')

  return {
    method: 'POST',
    nextUrl: url,
    url: url.toString(),
    json: vi.fn(() => Promise.resolve({})),
    headers: new Headers(),
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as NextRequest
}

// Helper to setup authenticated user with specific role
function setupAuthenticatedUser(role: string, stores: object[] = []) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-123', email: 'test@example.com' } },
    error: null,
  })

  const profileQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { role, store_id: null, is_platform_admin: false, default_store_id: null },
      error: null,
    }),
  }

  const storeUsersQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({
      data: stores.length > 0 ? stores : [
        {
          id: 'su-1',
          store_id: 'store-123',
          user_id: 'user-123',
          role,
          is_billing_owner: role === 'Owner',
          store: { id: 'store-123', name: 'Test Store', is_active: true },
        },
      ],
      error: null,
    }),
  }

  return { profileQuery, storeUsersQuery }
}

describe('Shift Clock Out API Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/shifts/:shiftId/clock-out', () => {
    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        })

        const { POST } = await import('@/app/api/shifts/[shiftId]/clock-out/route')

        const request = createMockRequest()
        const response = await POST(request, { params: Promise.resolve({ shiftId: 'shift-123' }) })
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.code).toBe('UNAUTHORIZED')
      })
    })

    describe('Authorization', () => {
      it('should return 403 when user tries to clock out another user shift', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        const shiftQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'shift-123',
              user_id: 'other-user-456', // Different user
              store_id: 'store-123',
              clock_in_time: '2025-01-15T09:00:00Z',
              clock_out_time: null,
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

        const { POST } = await import('@/app/api/shifts/[shiftId]/clock-out/route')

        const request = createMockRequest()
        const response = await POST(request, { params: Promise.resolve({ shiftId: 'shift-123' }) })
        const data = await response.json()

        expect(response.status).toBe(403)
        expect(data.code).toBe('FORBIDDEN')
      })

      it('should allow Owner to clock out any user shift', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Owner')

        const clockInTime = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString() // 8 hours ago

        const shiftQuery = {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn()
            .mockResolvedValueOnce({
              data: {
                id: 'shift-123',
                user_id: 'other-user-456',
                store_id: 'store-123',
                clock_in_time: clockInTime,
                clock_out_time: null,
              },
              error: null,
            })
            .mockResolvedValueOnce({
              data: {
                id: 'shift-123',
                user_id: 'other-user-456',
                store_id: 'store-123',
                clock_in_time: clockInTime,
                clock_out_time: new Date().toISOString(),
                store: { id: 'store-123', name: 'Test Store' },
                user: { id: 'other-user-456', full_name: 'John Doe', email: 'john@example.com' },
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

        const { POST } = await import('@/app/api/shifts/[shiftId]/clock-out/route')

        const request = createMockRequest()
        const response = await POST(request, { params: Promise.resolve({ shiftId: 'shift-123' }) })
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
      })
    })

    describe('Clock Out Logic', () => {
      it('should return 404 when shift not found', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        const shiftQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        }

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'shifts') return shiftQuery
          return shiftQuery
        })

        const { POST } = await import('@/app/api/shifts/[shiftId]/clock-out/route')

        const request = createMockRequest()
        const response = await POST(request, { params: Promise.resolve({ shiftId: 'nonexistent' }) })
        const data = await response.json()

        expect(response.status).toBe(404)
        expect(data.code).toBe('NOT_FOUND')
      })

      it('should return 400 when not clocked in', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        const shiftQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'shift-123',
              user_id: 'user-123', // Same user
              store_id: 'store-123',
              clock_in_time: null, // Not clocked in
              clock_out_time: null,
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

        const { POST } = await import('@/app/api/shifts/[shiftId]/clock-out/route')

        const request = createMockRequest()
        const response = await POST(request, { params: Promise.resolve({ shiftId: 'shift-123' }) })
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.code).toBe('BAD_REQUEST')
        expect(data.message).toContain('clock in')
      })

      it('should return 400 when already clocked out', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        const shiftQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'shift-123',
              user_id: 'user-123',
              store_id: 'store-123',
              clock_in_time: '2025-01-15T09:00:00Z',
              clock_out_time: '2025-01-15T17:00:00Z', // Already clocked out
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

        const { POST } = await import('@/app/api/shifts/[shiftId]/clock-out/route')

        const request = createMockRequest()
        const response = await POST(request, { params: Promise.resolve({ shiftId: 'shift-123' }) })
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.code).toBe('BAD_REQUEST')
        expect(data.message).toContain('Already clocked out')
      })

      it('should successfully clock out and calculate hours worked', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        const clockInTime = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString() // 8 hours ago

        const shiftQuery = {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn()
            .mockResolvedValueOnce({
              data: {
                id: 'shift-123',
                user_id: 'user-123',
                store_id: 'store-123',
                clock_in_time: clockInTime,
                clock_out_time: null,
              },
              error: null,
            })
            .mockResolvedValueOnce({
              data: {
                id: 'shift-123',
                user_id: 'user-123',
                store_id: 'store-123',
                clock_in_time: clockInTime,
                clock_out_time: new Date().toISOString(),
                store: { id: 'store-123', name: 'Test Store' },
                user: { id: 'user-123', full_name: 'Test User', email: 'test@example.com' },
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

        const { POST } = await import('@/app/api/shifts/[shiftId]/clock-out/route')

        const request = createMockRequest()
        const response = await POST(request, { params: Promise.resolve({ shiftId: 'shift-123' }) })
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.shift).toBeDefined()
        expect(data.data.hoursWorked).toBeCloseTo(8, 0) // Approximately 8 hours
      })

      it('should handle race condition when concurrent clock out', async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser('Staff')

        const clockInTime = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()

        const shiftQuery = {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn()
            .mockResolvedValueOnce({
              data: {
                id: 'shift-123',
                user_id: 'user-123',
                store_id: 'store-123',
                clock_in_time: clockInTime,
                clock_out_time: null,
              },
              error: null,
            })
            .mockResolvedValueOnce({
              data: null, // No row updated - race condition
              error: { code: 'PGRST116' },
            }),
        }

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'store_users') return storeUsersQuery
          if (table === 'shifts') return shiftQuery
          return shiftQuery
        })

        const { POST } = await import('@/app/api/shifts/[shiftId]/clock-out/route')

        const request = createMockRequest()
        const response = await POST(request, { params: Promise.resolve({ shiftId: 'shift-123' }) })
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.message).toContain('Already clocked out')
      })
    })
  })
})
