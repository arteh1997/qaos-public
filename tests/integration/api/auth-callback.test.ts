import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock next/server with redirect support (overrides setup.ts mock)
vi.mock('next/server', async () => {
  const actual = await vi.importActual('next/server') as Record<string, unknown>
  return {
    ...actual,
    NextResponse: {
      json: vi.fn((data: unknown, init?: ResponseInit) => ({
        json: async () => data,
        status: init?.status ?? 200,
        headers: new Map(Object.entries((init?.headers as Record<string, string>) ?? {})),
      })),
      redirect: vi.fn((url: string | URL) => {
        const urlStr = typeof url === 'string' ? url : url.toString()
        const cookieMap = new Map<string, { value: string; options?: Record<string, unknown> }>()
        return {
          status: 307,
          headers: new Headers({ location: urlStr }),
          cookies: {
            set: vi.fn((name: string, value: string, options?: Record<string, unknown>) => {
              cookieMap.set(name, { value, options })
            }),
            get: vi.fn((name: string) => cookieMap.get(name)),
            getAll: vi.fn(() => Array.from(cookieMap.entries()).map(([name, { value }]) => ({ name, value }))),
          },
        }
      }),
    },
  }
})

// Mock admin client
const mockAdminFrom = vi.fn()
const mockAdminClient = {
  from: mockAdminFrom,
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}))

// Mock the Supabase SSR createServerClient
const mockExchangeCodeForSession = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  })),
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

// Import after mocks
import { GET } from '@/app/api/auth/callback/route'

describe('GET /api/auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createCallbackRequest(queryParams: Record<string, string> = {}): NextRequest {
    const url = new URL('http://localhost:3000/api/auth/callback')
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
    return {
      method: 'GET',
      headers: new Headers(),
      nextUrl: url,
      url: url.toString(),
      cookies: {
        get: vi.fn(),
        getAll: vi.fn(() => []),
        set: vi.fn(),
        delete: vi.fn(),
      },
    } as unknown as NextRequest
  }

  it('should redirect to /login?error= when code param is missing', async () => {
    const request = createCallbackRequest()
    const response = await GET(request)

    expect(response.status).toBe(307)
    const location = response.headers.get('location')
    expect(location).toContain('/login?error=auth_callback_failed')
  })

  it('should redirect to /login?error= when code exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid code' },
    })

    const request = createCallbackRequest({ code: 'invalid-code' })
    const response = await GET(request)

    expect(response.status).toBe(307)
    const location = response.headers.get('location')
    expect(location).toContain('/login?error=auth_callback_failed')
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('invalid-code')
  })

  it('should redirect to / when code exchange succeeds and profile exists', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            user_metadata: { full_name: 'Test User' },
          },
        },
      },
      error: null,
    })

    // Profile exists
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'user-123' },
            error: null,
          }),
        }),
      }),
    })

    const request = createCallbackRequest({ code: 'valid-code' })
    const response = await GET(request)

    expect(response.status).toBe(307)
    const location = response.headers.get('location')
    expect(location).toBe('http://localhost:3000/')
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('valid-code')
  })

  it('should create a profile when code exchange succeeds but no profile exists', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'new-user-456',
            email: 'newuser@gmail.com',
            user_metadata: { full_name: 'New Google User', name: 'New Google User' },
          },
        },
      },
      error: null,
    })

    const mockUpsert = vi.fn().mockResolvedValue({ error: null })

    // First call: select profile (not found)
    // Second call: upsert profile
    let callCount = 0
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        callCount++
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116', message: 'not found' },
                }),
              }),
            }),
          }
        }
        return { upsert: mockUpsert }
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() }
    })

    const request = createCallbackRequest({ code: 'valid-code' })
    const response = await GET(request)

    expect(response.status).toBe(307)
    const location = response.headers.get('location')
    expect(location).toBe('http://localhost:3000/')
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        id: 'new-user-456',
        email: 'newuser@gmail.com',
        full_name: 'New Google User',
        role: 'Owner',
        status: 'Active',
      },
      { onConflict: 'id' }
    )
  })

  it('should still redirect to / even if profile creation fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-789',
            email: 'fail@example.com',
            user_metadata: { full_name: 'Fail User' },
          },
        },
      },
      error: null,
    })

    // Profile lookup throws
    mockAdminFrom.mockImplementation(() => {
      throw new Error('Database connection error')
    })

    const request = createCallbackRequest({ code: 'valid-code' })
    const response = await GET(request)

    // Should still redirect to / — session is valid even if profile creation failed
    expect(response.status).toBe(307)
    const location = response.headers.get('location')
    expect(location).toBe('http://localhost:3000/')
  })

  it('should use email prefix as fallback name when no metadata name', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-no-name',
            email: 'noname@example.com',
            user_metadata: {},
          },
        },
      },
      error: null,
    })

    const mockUpsert = vi.fn().mockResolvedValue({ error: null })

    let callCount = 0
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        callCount++
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116' },
                }),
              }),
            }),
          }
        }
        return { upsert: mockUpsert }
      }
      return {}
    })

    const request = createCallbackRequest({ code: 'valid-code' })
    await GET(request)

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: 'noname',
      }),
      { onConflict: 'id' }
    )
  })
})
