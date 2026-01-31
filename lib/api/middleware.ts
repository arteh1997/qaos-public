import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitConfig } from '@/lib/rate-limit'
import { AppRole } from '@/types'
import {
  generateRequestId,
  apiUnauthorized,
  apiForbidden,
  apiRateLimited,
} from './response'

/**
 * API Middleware Helpers
 * Common patterns for authentication, authorization, and rate limiting
 */

export interface AuthContext {
  user: { id: string; email?: string }
  profile: { role: AppRole; store_id: string | null }
  requestId: string
  supabase: Awaited<ReturnType<typeof createClient>>
}

export interface ApiMiddlewareOptions {
  /** Required roles to access the endpoint */
  allowedRoles?: AppRole[]
  /** Rate limit configuration */
  rateLimit?: {
    key: string
    config: RateLimitConfig
  }
  /** Whether the endpoint requires authentication (default: true) */
  requireAuth?: boolean
}

/**
 * Authenticate and authorize an API request
 * Returns the auth context if successful, or an error response
 */
export async function withApiAuth(
  request: NextRequest,
  options: ApiMiddlewareOptions = {}
): Promise<
  | { success: true; context: AuthContext }
  | { success: false; response: ReturnType<typeof apiUnauthorized> }
> {
  const requestId = generateRequestId()
  const { allowedRoles, rateLimit: rateLimitConfig, requireAuth = true } = options

  // Create Supabase client
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()

  if (!user && requireAuth) {
    return { success: false, response: apiUnauthorized(requestId) }
  }

  // If no auth required and no user, return minimal context
  if (!user) {
    return {
      success: true,
      context: {
        user: { id: '' },
        profile: { role: 'Staff' as AppRole, store_id: null },
        requestId,
        supabase,
      },
    }
  }

  // Apply rate limiting if configured
  if (rateLimitConfig) {
    const result = rateLimit(
      `${rateLimitConfig.key}:${user.id}`,
      rateLimitConfig.config
    )
    if (!result.success) {
      return { success: false, response: apiRateLimited(result, requestId) }
    }
  }

  // Get user profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role, store_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return { success: false, response: apiUnauthorized(requestId) }
  }

  // Check role authorization
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(profile.role as AppRole)) {
      return {
        success: false,
        response: apiForbidden(
          `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
          requestId
        ),
      }
    }
  }

  return {
    success: true,
    context: {
      user: { id: user.id, email: user.email },
      profile: {
        role: profile.role as AppRole,
        store_id: profile.store_id,
      },
      requestId,
      supabase,
    },
  }
}

/**
 * Check if user can access a specific store
 */
export function canAccessStore(
  profile: { role: AppRole; store_id: string | null },
  targetStoreId: string
): boolean {
  // Admin and Driver have global access
  if (profile.role === 'Admin' || profile.role === 'Driver') {
    return true
  }

  // Staff can only access their assigned store
  return profile.store_id === targetStoreId
}

/**
 * Parse pagination parameters from request
 */
export function parsePaginationParams(
  request: NextRequest,
  defaults: { page?: number; pageSize?: number } = {}
): { page: number; pageSize: number; from: number; to: number } {
  const searchParams = request.nextUrl.searchParams

  const page = Math.max(1, parseInt(searchParams.get('page') ?? String(defaults.page ?? 1), 10))
  const pageSize = Math.min(
    100, // Max page size
    Math.max(1, parseInt(searchParams.get('pageSize') ?? String(defaults.pageSize ?? 20), 10))
  )

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  return { page, pageSize, from, to }
}

/**
 * Parse common filter parameters
 */
export function parseFilterParams(request: NextRequest): {
  search: string | null
  storeId: string | null
  status: string | null
  date: string | null
} {
  const searchParams = request.nextUrl.searchParams

  return {
    search: searchParams.get('search'),
    storeId: searchParams.get('store_id'),
    status: searchParams.get('status'),
    date: searchParams.get('date'),
  }
}
