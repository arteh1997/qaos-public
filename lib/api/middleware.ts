import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitConfig } from '@/lib/rate-limit'
import { validateCSRFToken } from '@/lib/csrf'
import { AppRole, StoreUserWithStore, LegacyAppRole } from '@/types'
import {
  generateRequestId,
  apiUnauthorized,
  apiForbidden,
  apiRateLimited,
  apiBadRequest,
} from './response'
import {
  canAccessStore as canAccessStoreAuth,
  getRoleAtStore,
  canManageStore as canManageStoreAuth,
  canManageUsersAtStore as canManageUsersAuth,
  normalizeRole,
} from '@/lib/auth'

/**
 * API Middleware Helpers
 * Common patterns for authentication, authorization, and rate limiting
 *
 * Multi-tenant model: Users have roles at specific stores via store_users table.
 * Permission checks should use the store context from the request.
 */

export interface AuthContext {
  user: { id: string; email?: string }
  profile: {
    role: AppRole | null
    store_id: string | null
    is_platform_admin: boolean
  }
  stores: StoreUserWithStore[]  // User's store memberships
  requestId: string
  supabase: Awaited<ReturnType<typeof createClient>>
}

export interface ApiMiddlewareOptions {
  /** Required roles to access the endpoint (checked against any store membership) */
  allowedRoles?: AppRole[]
  /** Required roles at a specific store (pass storeId in request to check) */
  requireRoleAtStore?: AppRole[]
  /** Rate limit configuration */
  rateLimit?: {
    key: string
    config: RateLimitConfig
  }
  /** Whether the endpoint requires authentication (default: true) */
  requireAuth?: boolean
  /** Whether to require platform admin access */
  requirePlatformAdmin?: boolean
  /** Whether to require CSRF token validation for state-changing requests (default: false) */
  requireCSRF?: boolean
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
  const {
    allowedRoles,
    requireRoleAtStore,
    rateLimit: rateLimitConfig,
    requireAuth = true,
    requirePlatformAdmin = false,
    requireCSRF = false,
  } = options

  // Validate CSRF token for state-changing requests
  if (requireCSRF) {
    const method = request.method.toUpperCase()
    const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

    if (isStateChanging) {
      const isValidCSRF = await validateCSRFToken(request)
      if (!isValidCSRF) {
        return { success: false, response: apiBadRequest('Invalid or missing CSRF token', requestId) }
      }
    }
  }

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
        profile: { role: null, store_id: null, is_platform_admin: false },
        stores: [],
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

  // Fetch profile and store memberships in parallel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any
  const [profileResult, storesResult] = await Promise.all([
    supabaseAny
      .from('profiles')
      .select('role, store_id, is_platform_admin, default_store_id')
      .eq('id', user.id)
      .single(),
    supabaseAny
      .from('store_users')
      .select('*, store:stores(*)')
      .eq('user_id', user.id),
  ])

  const profile = profileResult.data
  if (!profile) {
    return { success: false, response: apiUnauthorized(requestId) }
  }

  // Filter out any memberships without valid store data
  const stores: StoreUserWithStore[] = (storesResult.data || []).filter(
    (s: StoreUserWithStore) => s.store !== null && s.store !== undefined
  )

  // Check platform admin requirement
  if (requirePlatformAdmin && !profile.is_platform_admin) {
    return {
      success: false,
      response: apiForbidden('This action requires platform administrator access', requestId),
    }
  }

  // Check role authorization (any store membership with required role)
  if (allowedRoles && allowedRoles.length > 0) {
    const hasRequiredRole = stores.some((s: StoreUserWithStore) =>
      allowedRoles.includes(s.role)
    )
    // Also check legacy profile.role for backward compatibility
    const legacyRole = normalizeRole(profile.role as AppRole | LegacyAppRole)
    const hasLegacyRole = legacyRole && allowedRoles.includes(legacyRole)

    if (!hasRequiredRole && !hasLegacyRole && !profile.is_platform_admin) {
      return {
        success: false,
        response: apiForbidden(
          `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
          requestId
        ),
      }
    }
  }

  // Check role at specific store if required
  if (requireRoleAtStore && requireRoleAtStore.length > 0) {
    const storeId = request.nextUrl.searchParams.get('store_id')
    if (storeId) {
      const roleAtStore = getRoleAtStore(stores, storeId)
      if (!roleAtStore || !requireRoleAtStore.includes(roleAtStore)) {
        if (!profile.is_platform_admin) {
          return {
            success: false,
            response: apiForbidden(
              `This action requires one of the following roles at this store: ${requireRoleAtStore.join(', ')}`,
              requestId
            ),
          }
        }
      }
    }
  }

  return {
    success: true,
    context: {
      user: { id: user.id, email: user.email },
      profile: {
        role: normalizeRole(profile.role as AppRole | LegacyAppRole),
        store_id: profile.store_id,
        is_platform_admin: profile.is_platform_admin || false,
      },
      stores,
      requestId,
      supabase,
    },
  }
}

/**
 * Check if user can access a specific store
 * Uses store_users membership for multi-tenant access control
 */
export function canAccessStore(
  context: AuthContext,
  targetStoreId: string
): boolean {
  // Platform admins can access all stores
  if (context.profile.is_platform_admin) {
    return true
  }

  // Check store_users membership
  return canAccessStoreAuth(context.stores, targetStoreId)
}

/**
 * Check if user can manage a specific store (Owner or Manager role)
 */
export function canManageStore(
  context: AuthContext,
  targetStoreId: string
): boolean {
  if (context.profile.is_platform_admin) {
    return true
  }
  return canManageStoreAuth(context.stores, targetStoreId)
}

/**
 * Check if user can manage users at a specific store (Owner only)
 */
export function canManageUsersAtStore(
  context: AuthContext,
  targetStoreId: string
): boolean {
  if (context.profile.is_platform_admin) {
    return true
  }
  return canManageUsersAuth(context.stores, targetStoreId)
}

/**
 * Get user's role at a specific store
 */
export function getUserRoleAtStore(
  context: AuthContext,
  targetStoreId: string
): AppRole | null {
  return getRoleAtStore(context.stores, targetStoreId)
}

/**
 * Get all store IDs the user has access to
 */
export function getAccessibleStoreIds(context: AuthContext): string[] {
  return context.stores.map(s => s.store_id)
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
