import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, RATE_LIMITS, getRateLimitHeaders } from '@/lib/rate-limit'
import { loginSchema } from '@/lib/validations/auth'
import { auditLog } from '@/lib/audit'
import { validateCSRFToken } from '@/lib/csrf'

/**
 * POST /api/auth/login - Server-side login with rate limiting
 *
 * This endpoint provides brute-force protection by rate limiting login attempts
 * based on IP address.
 */
export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown'

    // Apply rate limiting (stricter for auth endpoints)
    const rateLimitResult = rateLimit(`login:${ip}`, {
      limit: 5, // 5 attempts
      windowMs: 15 * 60 * 1000, // per 15 minutes
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Too many login attempts. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      )
    }

    // CSRF protection
    const isValidCSRF = await validateCSRFToken(request)
    if (!isValidCSRF) {
      return NextResponse.json(
        { success: false, message: 'Invalid or missing CSRF token' },
        {
          status: 403,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = loginSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: validationResult.error.issues.map(e => e.message).join(', ')
        },
        {
          status: 400,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      )
    }

    const { email, password } = validationResult.data

    // Authenticate with Supabase
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // Don't reveal whether email exists - use generic message
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid email or password'
        },
        {
          status: 401,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      )
    }

    // Audit log successful login
    const adminClient = createAdminClient()
    await auditLog(adminClient, {
      userId: data.user.id,
      userEmail: data.user.email,
      action: 'auth.login',
      details: { method: 'password' },
      request,
    })

    // Successful login - return session info
    return NextResponse.json(
      {
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: data.user.id,
            email: data.user.email,
          },
          // Session is automatically set in cookies by Supabase
        }
      },
      {
        status: 200,
        headers: getRateLimitHeaders(rateLimitResult),
      }
    )
  } catch (error) {
    console.error('[Auth/Login] Error:', error)
    return NextResponse.json(
      { success: false, message: 'An error occurred during login' },
      { status: 500 }
    )
  }
}
