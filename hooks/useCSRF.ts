'use client'

import { useCallback } from 'react'

const CSRF_COOKIE_NAME = 'csrf_token'
const CSRF_HEADER_NAME = 'x-csrf-token'

/**
 * Get CSRF token from cookie
 */
function getCSRFTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null

  const match = document.cookie.match(new RegExp(`(^| )${CSRF_COOKIE_NAME}=([^;]+)`))
  return match ? match[2] : null
}

/**
 * Hook for making CSRF-protected fetch requests
 */
export function useCSRF() {
  /**
   * Make a fetch request with CSRF token included
   */
  const csrfFetch = useCallback(async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    const token = getCSRFTokenFromCookie()

    const headers = new Headers(options.headers)
    headers.set('Content-Type', 'application/json')

    if (token) {
      headers.set(CSRF_HEADER_NAME, token)
    }

    return fetch(url, {
      ...options,
      headers,
      credentials: 'same-origin', // Ensure cookies are sent
    })
  }, [])

  return { csrfFetch }
}

/**
 * Standalone function to create headers with CSRF token
 * Use this when you can't use the hook (e.g., in non-component code)
 */
export function getCSRFHeaders(): Record<string, string> {
  const token = getCSRFTokenFromCookie()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers[CSRF_HEADER_NAME] = token
  }

  return headers
}
