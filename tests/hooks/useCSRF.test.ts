/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCSRF, getCSRFHeaders } from '@/hooks/useCSRF'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useCSRF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear cookies
    document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  })

  afterEach(() => {
    document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  })

  describe('csrfFetch', () => {
    it('should make fetch request without token when no cookie set', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }))

      const { result } = renderHook(() => useCSRF())

      await act(async () => {
        await result.current.csrfFetch('/api/test')
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        headers: expect.any(Headers),
        credentials: 'same-origin',
      }))

      const calledHeaders = mockFetch.mock.calls[0][1].headers as Headers
      expect(calledHeaders.get('x-csrf-token')).toBeNull()
      expect(calledHeaders.get('Content-Type')).toBe('application/json')
    })

    it('should include CSRF token from cookie when set', async () => {
      document.cookie = 'csrf_token=test-token-123'
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }))

      const { result } = renderHook(() => useCSRF())

      await act(async () => {
        await result.current.csrfFetch('/api/test')
      })

      const calledHeaders = mockFetch.mock.calls[0][1].headers as Headers
      expect(calledHeaders.get('x-csrf-token')).toBe('test-token-123')
    })

    it('should merge with existing headers', async () => {
      document.cookie = 'csrf_token=test-token'
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }))

      const { result } = renderHook(() => useCSRF())

      await act(async () => {
        await result.current.csrfFetch('/api/test', {
          headers: {
            'X-Custom-Header': 'custom-value',
          },
        })
      })

      const calledHeaders = mockFetch.mock.calls[0][1].headers as Headers
      expect(calledHeaders.get('x-csrf-token')).toBe('test-token')
      expect(calledHeaders.get('Content-Type')).toBe('application/json')
      expect(calledHeaders.get('X-Custom-Header')).toBe('custom-value')
    })

    it('should pass through other fetch options', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }))

      const { result } = renderHook(() => useCSRF())

      await act(async () => {
        await result.current.csrfFetch('/api/test', {
          method: 'POST',
          body: JSON.stringify({ data: 'test' }),
        })
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ data: 'test' }),
        credentials: 'same-origin',
      }))
    })

    it('should always set credentials to same-origin', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }))

      const { result } = renderHook(() => useCSRF())

      await act(async () => {
        await result.current.csrfFetch('/api/test', {
          credentials: 'include', // Try to override
        })
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        credentials: 'same-origin', // Should be overridden
      }))
    })

    it('should return the fetch response', async () => {
      const mockResponse = new Response(JSON.stringify({ success: true }), { status: 200 })
      mockFetch.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useCSRF())

      let response: Response | undefined
      await act(async () => {
        response = await result.current.csrfFetch('/api/test')
      })

      expect(response).toBe(mockResponse)
    })
  })

  describe('getCSRFHeaders', () => {
    it('should return headers without token when no cookie set', () => {
      const headers = getCSRFHeaders()

      expect(headers['Content-Type']).toBe('application/json')
      expect(headers['x-csrf-token']).toBeUndefined()
    })

    it('should include CSRF token from cookie', () => {
      document.cookie = 'csrf_token=header-test-token'

      const headers = getCSRFHeaders()

      expect(headers['Content-Type']).toBe('application/json')
      expect(headers['x-csrf-token']).toBe('header-test-token')
    })

    it('should handle cookie with spaces before name', () => {
      document.cookie = 'other_cookie=value'
      document.cookie = 'csrf_token=spaced-token'

      const headers = getCSRFHeaders()

      expect(headers['x-csrf-token']).toBe('spaced-token')
    })
  })
})
