import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the getCSRFToken function
vi.mock('@/lib/csrf', () => ({
  getCSRFToken: vi.fn(),
}))

describe('CSRF API Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/csrf', () => {
    it('should return success when CSRF token is generated', async () => {
      const { getCSRFToken } = await import('@/lib/csrf')
      vi.mocked(getCSRFToken).mockResolvedValue('mock-csrf-token')

      const { GET } = await import('@/app/api/csrf/route')

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(getCSRFToken).toHaveBeenCalled()
    })

    it('should return 500 when CSRF token generation fails', async () => {
      const { getCSRFToken } = await import('@/lib/csrf')
      vi.mocked(getCSRFToken).mockRejectedValue(new Error('Token generation failed'))

      const { GET } = await import('@/app/api/csrf/route')

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.message).toBe('Failed to generate CSRF token')
    })

    it('should handle non-Error exceptions', async () => {
      const { getCSRFToken } = await import('@/lib/csrf')
      vi.mocked(getCSRFToken).mockRejectedValue('Unknown error')

      const { GET } = await import('@/app/api/csrf/route')

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
    })
  })
})
