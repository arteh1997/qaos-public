/**
 * CSRF Protection Utilities
 *
 * Implements double-submit cookie pattern for CSRF protection.
 * A random token is stored in both a cookie and sent with requests.
 * The server validates that both match.
 */

import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const CSRF_COOKIE_NAME = 'csrf_token'
const CSRF_HEADER_NAME = 'x-csrf-token'
const TOKEN_LENGTH = 32

/**
 * Generate a cryptographically secure random token
 */
function generateToken(): string {
  const array = new Uint8Array(TOKEN_LENGTH)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Get or create a CSRF token for the current session
 * Used in Server Components/API routes
 */
export async function getCSRFToken(): Promise<string> {
  const cookieStore = await cookies()
  let token = cookieStore.get(CSRF_COOKIE_NAME)?.value

  if (!token) {
    token = generateToken()
    cookieStore.set(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Must be readable by client for double-submit pattern
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    })
  }

  return token
}

/**
 * Validate CSRF token from request
 * Compares the token in the cookie with the token in the header
 */
export async function validateCSRFToken(request: NextRequest): Promise<boolean> {
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value
  const headerToken = request.headers.get(CSRF_HEADER_NAME)

  if (!cookieToken || !headerToken) {
    return false
  }

  // Use timing-safe comparison to prevent timing attacks
  return timingSafeEqual(cookieToken, headerToken)
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

/**
 * Client-side helper to get CSRF token from cookie
 */
export function getCSRFTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null

  const match = document.cookie.match(new RegExp(`(^| )${CSRF_COOKIE_NAME}=([^;]+)`))
  return match ? match[2] : null
}

/**
 * Create headers with CSRF token for fetch requests
 */
export function getCSRFHeaders(): HeadersInit {
  const token = getCSRFTokenFromCookie()
  if (!token) return {}

  return {
    [CSRF_HEADER_NAME]: token,
  }
}
