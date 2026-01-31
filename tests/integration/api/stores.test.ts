import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn(),
  })),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}))

// Mock rate limit to always allow
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({
    success: true,
    remaining: 99,
    resetTime: Date.now() + 60000,
    limit: 100,
  })),
  RATE_LIMITS: {
    api: { limit: 100, windowMs: 60000 },
    auth: { limit: 10, windowMs: 60000 },
    createUser: { limit: 5, windowMs: 60000 },
    reports: { limit: 20, windowMs: 60000 },
  },
  getRateLimitHeaders: vi.fn(() => ({
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': '99',
    'X-RateLimit-Reset': String(Date.now() + 60000),
  })),
}))

// Helper to create mock NextRequest
function createMockRequest(
  method: string,
  body?: object,
  searchParams?: Record<string, string>
): NextRequest {
  const url = new URL('http://localhost:3000/api/stores')
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  return {
    method,
    nextUrl: url,
    json: vi.fn(() => Promise.resolve(body || {})),
  } as unknown as NextRequest
}

describe('Stores API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/stores', () => {
    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        // Setup: User not authenticated
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        })

        // Import after mocks are set up
        const { GET } = await import('@/app/api/stores/route')

        const request = createMockRequest('GET')
        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.success).toBe(false)
        expect(data.code).toBe('UNAUTHORIZED')
      })
    })

    describe('Authorized Requests', () => {
      beforeEach(() => {
        // Setup: Authenticated Admin user
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: {
            user: { id: 'user-123', email: 'admin@test.com' },
          },
          error: null,
        })
      })

      it('should return stores list for authenticated user', async () => {
        // Setup profile query
        const profileQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role: 'Admin', store_id: null },
            error: null,
          }),
        }

        // Setup stores query
        const storesQuery = {
          select: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({
            data: [
              { id: 'store-1', name: 'Store A', is_active: true },
              { id: 'store-2', name: 'Store B', is_active: true },
            ],
            count: 2,
            error: null,
          }),
        }

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          if (table === 'stores') return storesQuery
          return storesQuery
        })

        const { GET } = await import('@/app/api/stores/route')

        const request = createMockRequest('GET')
        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data).toHaveLength(2)
        expect(data.pagination).toBeDefined()
      })
    })
  })

  describe('POST /api/stores', () => {
    describe('Authorization', () => {
      it('should return 403 for non-Admin users', async () => {
        // Setup: Authenticated Driver user (not Admin)
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: {
            user: { id: 'user-123', email: 'driver@test.com' },
          },
          error: null,
        })

        const profileQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role: 'Driver', store_id: null },
            error: null,
          }),
        }

        mockSupabaseClient.from.mockImplementation(() => profileQuery)

        const { POST } = await import('@/app/api/stores/route')

        const request = createMockRequest('POST', {
          name: 'New Store',
          is_active: true,
        })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(403)
        expect(data.success).toBe(false)
        expect(data.code).toBe('FORBIDDEN')
      })
    })

    describe('Validation', () => {
      beforeEach(() => {
        // Setup: Authenticated Admin user
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: {
            user: { id: 'user-123', email: 'admin@test.com' },
          },
          error: null,
        })

        const profileQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role: 'Admin', store_id: null },
            error: null,
          }),
        }

        mockSupabaseClient.from.mockImplementation(() => profileQuery)
      })

      it('should return 400 for invalid store data', async () => {
        const { POST } = await import('@/app/api/stores/route')

        const request = createMockRequest('POST', {
          name: 'A', // Too short
          is_active: true,
        })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.success).toBe(false)
        expect(data.code).toBe('BAD_REQUEST')
      })

      it('should return 400 when missing is_active', async () => {
        const { POST } = await import('@/app/api/stores/route')

        const request = createMockRequest('POST', {
          name: 'Valid Store Name',
          // Missing is_active
        })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.success).toBe(false)
      })
    })

    describe('Successful Creation', () => {
      it('should create store for Admin with valid data', async () => {
        // Setup: Authenticated Admin user
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: {
            user: { id: 'user-123', email: 'admin@test.com' },
          },
          error: null,
        })

        const profileQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role: 'Admin', store_id: null },
            error: null,
          }),
        }

        const insertQuery = {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'new-store-123',
              name: 'New Valid Store',
              address: '123 Main St',
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          }),
        }

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileQuery
          return insertQuery
        })

        const { POST } = await import('@/app/api/stores/route')

        const request = createMockRequest('POST', {
          name: 'New Valid Store',
          address: '123 Main St',
          is_active: true,
        })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(201)
        expect(data.success).toBe(true)
        expect(data.data.name).toBe('New Valid Store')
      })
    })
  })
})
