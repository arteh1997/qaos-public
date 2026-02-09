import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
  })),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}))

describe('Health API Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/health', () => {
    it('should return healthy status when all checks pass', async () => {
      // Mock successful auth check
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      // Mock successful database queries
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'stores') {
          return {
            select: vi.fn().mockResolvedValue({
              count: 5,
              error: null,
            }),
          }
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [{ id: 'profile-1' }],
              error: null,
            }),
          }
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      })

      const { GET } = await import('@/app/api/health/route')

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('healthy')
      expect(data.timestamp).toBeDefined()
      expect(data.checks).toBeDefined()
      expect(data.total_duration_ms).toBeDefined()
    })

    it('should return unhealthy status when auth check fails', async () => {
      // Mock auth error
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Auth error' },
      })

      // Mock successful database queries
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'stores') {
          return {
            select: vi.fn().mockResolvedValue({
              count: 5,
              error: null,
            }),
          }
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [{ id: 'profile-1' }],
              error: null,
            }),
          }
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      })

      const { GET } = await import('@/app/api/health/route')

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('unhealthy')
      expect(data.checks.auth.status).toBe('error')
    })

    it('should return unhealthy status when database check fails', async () => {
      // Mock successful auth
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      // Mock database error
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'stores') {
          return {
            select: vi.fn().mockResolvedValue({
              count: null,
              error: { message: 'Database error' },
            }),
          }
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [{ id: 'profile-1' }],
              error: null,
            }),
          }
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      })

      const { GET } = await import('@/app/api/health/route')

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('unhealthy')
      expect(data.checks.database.status).toBe('error')
    })

    it('should handle exceptions gracefully', async () => {
      // Mock auth throwing exception
      mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Network error'))

      // Mock successful database queries
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockResolvedValue({
          count: 5,
          error: null,
        }),
      }))

      const { GET } = await import('@/app/api/health/route')

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('unhealthy')
      expect(data.checks.auth.status).toBe('error')
      expect(data.checks.auth.error).toBe('Network error')
    })

    it('should include duration metrics for all checks', async () => {
      // Mock all successful
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'stores') {
          return {
            select: vi.fn().mockResolvedValue({
              count: 5,
              error: null,
            }),
          }
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [{ id: 'profile-1' }],
              error: null,
            }),
          }
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      })

      const { GET } = await import('@/app/api/health/route')

      const response = await GET()
      const data = await response.json()

      expect(data.total_duration_ms).toBeGreaterThanOrEqual(0)
      expect(data.checks.auth.duration_ms).toBeGreaterThanOrEqual(0)
    })

    it('should set Cache-Control header to no-store', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockResolvedValue({
          count: 5,
          error: null,
        }),
      }))

      const { GET } = await import('@/app/api/health/route')

      const response = await GET()

      expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate')
    })
  })
})
