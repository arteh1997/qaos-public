import { vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Create a chainable query builder mock for Supabase
 * This mocks the fluent API pattern of Supabase queries
 */
export function createChainableMock(resolvedValue: unknown = { data: null, error: null }) {
  const mock: Record<string, ReturnType<typeof vi.fn>> & { then?: typeof Promise.prototype.then } = {}
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike',
    'in', 'is', 'or', 'and', 'not', 'filter', 'match',
    'order', 'limit', 'range', 'single', 'maybeSingle', 'returns',
    'textSearch', 'contains', 'containedBy', 'overlaps',
  ]

  methods.forEach(method => {
    if (method === 'single' || method === 'maybeSingle') {
      mock[method] = vi.fn().mockResolvedValue(resolvedValue)
    } else if (method === 'range') {
      mock[method] = vi.fn().mockResolvedValue(resolvedValue)
    } else {
      mock[method] = vi.fn(() => mock)
    }
  })

  // Make the mock thenable so it can be awaited without calling .single()
   
  mock.then = ((resolve?: any) => Promise.resolve(resolvedValue).then(resolve)) as any

  return mock
}

/**
 * Create a mock Supabase client
 */
export function createMockSupabaseClient() {
  return {
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(),
    rpc: vi.fn(),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
  }
}

/**
 * Create a mock NextRequest
 */
export function createMockRequest(
  method: string,
  path: string,
  body?: object,
  searchParams?: Record<string, string>
): NextRequest {
  const url = new URL(`http://localhost:3000${path}`)
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  return {
    method,
    nextUrl: url,
    url: url.toString(),
    json: vi.fn(() => Promise.resolve(body || {})),
    headers: new Headers(),
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as NextRequest
}

/**
 * Setup authenticated user with a specific role
 */
export function setupAuthenticatedUser(
  mockSupabaseClient: ReturnType<typeof createMockSupabaseClient>,
  role: string,
  options: {
    userId?: string
    email?: string
    storeId?: string
    isBillingOwner?: boolean
    isPlatformAdmin?: boolean
  } = {}
) {
  const {
    userId = 'user-123',
    email = 'test@example.com',
    storeId = 'store-1',
    isBillingOwner = role === 'Owner',
    isPlatformAdmin = false,
  } = options

  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: userId, email } },
    error: null,
  })

  const profileQuery = createChainableMock({
    data: {
      id: userId,
      role,
      store_id: null,
      is_platform_admin: isPlatformAdmin,
      default_store_id: null,
      stripe_customer_id: null,
    },
    error: null,
  })

  const storeUsersQuery = createChainableMock({
    data: [
      {
        id: 'su-1',
        store_id: storeId,
        user_id: userId,
        role,
        is_billing_owner: isBillingOwner,
        store: { id: storeId, name: 'Test Store', is_active: true },
      },
    ],
    error: null,
  })

  return { profileQuery, storeUsersQuery }
}

/**
 * Setup unauthenticated request
 */
export function setupUnauthenticated(
  mockSupabaseClient: ReturnType<typeof createMockSupabaseClient>
) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: null,
  })
}

/**
 * Common mock for rate limiting to always allow requests
 */
export const mockRateLimitAlwaysAllow = {
  rateLimit: vi.fn(() => ({
    success: true,
    remaining: 99,
    resetTime: Date.now() + 60000,
    limit: 100,
  })),
  RATE_LIMITS: {
    api: { limit: 100, windowMs: 60000 },
    billing: { limit: 10, windowMs: 60000 },
    auth: { limit: 5, windowMs: 60000 },
  },
  getRateLimitHeaders: vi.fn(() => ({})),
}
