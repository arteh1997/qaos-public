'use client'

import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

// Fallback placeholders prevent build crashes when env vars aren't available
// (e.g. dependabot PR builds that don't have access to secrets).
// Client pages prerender as loading states so these placeholders are never called at runtime.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJplaceholder'

// For auth operations only - use the SSR client
let authClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (!authClient) {
    authClient = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_KEY)
  }
  return authClient
}

// Decoded JWT user info
interface JWTPayload {
  sub: string  // user id
  email?: string
  exp: number
  iat: number
  aud: string
  role?: string
}

// Helper to decode JWT without verification (we trust Supabase signed it)
function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    // Base64url decode
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

// Get user info directly from the JWT in cookies - completely bypasses Supabase client
export function getUserFromCookies(): { id: string; email?: string } | null {
  const token = getAccessTokenFromCookies()
  if (token === SUPABASE_KEY) {
    return null
  }

  const payload = decodeJWT(token)
  if (!payload) {
    return null
  }

  // Check if token is expired
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp < now) {
    return null
  }

  return {
    id: payload.sub,
    email: payload.email,
  }
}

// Helper to get the current user's access token directly from cookies
// This completely bypasses the Supabase client to avoid hanging issues
function getAccessTokenFromCookies(): string {
  if (typeof document === 'undefined') return SUPABASE_KEY

  // Supabase stores auth in cookies - try multiple formats
  const allCookies = document.cookie.split(';')

  // Build a map of cookie name -> value
  const cookieMap = new Map<string, string>()
  for (const cookie of allCookies) {
    const trimmed = cookie.trim()
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const name = trimmed.substring(0, eqIndex)
    const value = trimmed.substring(eqIndex + 1)
    cookieMap.set(name, value)
  }


  // Find the base cookie name (e.g., sb-xxxxx-auth-token)
  let baseCookieName: string | null = null
  for (const name of cookieMap.keys()) {
    if (name.startsWith('sb-') && name.endsWith('-auth-token')) {
      baseCookieName = name
      break
    }
  }

  // If no base cookie, check for chunked format (sb-xxxxx-auth-token.0, .1, .2, etc.)
  if (!baseCookieName) {
    for (const name of cookieMap.keys()) {
      if (name.startsWith('sb-') && name.includes('-auth-token.0')) {
        // Extract the base name without the .0
        baseCookieName = name.replace('.0', '')
        break
      }
    }
  }

  if (!baseCookieName) {
    return SUPABASE_KEY
  }

  // Try to get the value - either directly or by reassembling chunks
  let cookieValue: string | null = null

  // First, try direct cookie (non-chunked)
  if (cookieMap.has(baseCookieName)) {
    cookieValue = cookieMap.get(baseCookieName) || null
  } else {
    // Reassemble from chunks
    const chunks: string[] = []
    let i = 0
    while (cookieMap.has(`${baseCookieName}.${i}`)) {
      chunks.push(cookieMap.get(`${baseCookieName}.${i}`)!)
      i++
    }
    if (chunks.length > 0) {
      cookieValue = chunks.join('')
    }
  }

  if (!cookieValue) {
    return SUPABASE_KEY
  }

  // Parse the cookie value
  try {
    let decoded = decodeURIComponent(cookieValue)

    // Supabase SSR uses "base64-" prefix for the cookie value
    if (decoded.startsWith('base64-')) {
      decoded = decoded.substring(7) // Remove "base64-" prefix
    }

    // The cookie might be base64 encoded JSON or direct JSON
    let parsed: unknown
    try {
      parsed = JSON.parse(decoded)
    } catch {
      // Try base64 decode
      try {
        const base64Decoded = atob(decoded)
        parsed = JSON.parse(base64Decoded)
      } catch {
        // Maybe it's already a JWT token directly?
        if (decoded.split('.').length === 3) {
          return decoded
        }
        return SUPABASE_KEY
      }
    }

    // Handle array format [access_token, refresh_token, ...]
    if (Array.isArray(parsed) && parsed[0]) {
      return parsed[0]
    }

    // Handle object format { access_token, refresh_token, ... }
    if (parsed && typeof parsed === 'object' && 'access_token' in parsed) {
      return (parsed as { access_token: string }).access_token
    }
  } catch {
    // Failed to parse cookie
  }

  return SUPABASE_KEY
}

interface QueryOptions {
  select?: string
  order?: string
  filter?: Record<string, string>
  range?: { from: number; to: number }
  count?: boolean
}

export async function supabaseFetch<T>(
  table: string,
  options: QueryOptions = {}
): Promise<{ data: T[] | null; error: Error | null; count: number | null }> {
  try {
    const accessToken = getAccessTokenFromCookies()
    const params = new URLSearchParams()

    params.set('select', options.select || '*')

    if (options.order) {
      params.set('order', options.order)
    }

    if (options.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        params.set(key, value)
      })
    }

    if (options.range) {
      params.set('offset', options.range.from.toString())
      params.set('limit', (options.range.to - options.range.from + 1).toString())
    }

    const headers: HeadersInit = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }

    if (options.count) {
      headers['Prefer'] = 'count=exact'
    }

    const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`

    const response = await fetch(url, {
      headers,
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorBody}`)
    }

    const data = await response.json()

    let count = null
    if (options.count) {
      const contentRange = response.headers.get('content-range')
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)/)
        if (match) {
          count = parseInt(match[1], 10)
        }
      }
    }

    return { data, error: null, count }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Unknown error'), count: null }
  }
}

export async function supabaseInsert<T>(
  table: string,
  data: Record<string, unknown>
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const accessToken = getAccessTokenFromCookies()
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorBody = await response.json()
      throw new Error(errorBody.message || `HTTP ${response.status}`)
    }

    const result = await response.json()
    return { data: result[0] || null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Unknown error') }
  }
}

export async function supabaseUpdate<T>(
  table: string,
  id: string,
  data: Record<string, unknown>
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const accessToken = getAccessTokenFromCookies()
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorBody = await response.json()
      throw new Error(errorBody.message || `HTTP ${response.status}`)
    }

    const result = await response.json()
    return { data: result[0] || null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Unknown error') }
  }
}

export async function supabaseDelete(
  table: string,
  id: string
): Promise<{ error: Error | null }> {
  try {
    const accessToken = getAccessTokenFromCookies()
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const errorBody = await response.json()
      throw new Error(errorBody.message || `HTTP ${response.status}`)
    }

    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err : new Error('Unknown error') }
  }
}

export async function supabaseUpsert<T>(
  table: string,
  data: Record<string, unknown> | Record<string, unknown>[],
  onConflict: string
): Promise<{ data: T | T[] | null; error: Error | null }> {
  try {
    const accessToken = getAccessTokenFromCookies()
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorBody = await response.json()
      throw new Error(errorBody.message || `HTTP ${response.status}`)
    }

    const result = await response.json()
    return { data: result, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Unknown error') }
  }
}

export async function supabaseInsertMany<T>(
  table: string,
  data: Record<string, unknown>[]
): Promise<{ data: T[] | null; error: Error | null }> {
  try {
    const accessToken = getAccessTokenFromCookies()
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorBody = await response.json()
      throw new Error(errorBody.message || `HTTP ${response.status}`)
    }

    const result = await response.json()
    return { data: result, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Unknown error') }
  }
}
