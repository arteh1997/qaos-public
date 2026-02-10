import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, hasScope } from './api-keys'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'

/**
 * Middleware for API key-authenticated public API routes
 *
 * Usage:
 *   const auth = await withApiKey(request, { scope: 'inventory:read' })
 *   if (!auth.success) return auth.response
 *   // Use auth.storeId, auth.scopes
 */

interface ApiKeyAuthOptions {
  scope: string
}

interface ApiKeyAuthSuccess {
  success: true
  storeId: string
  scopes: string[]
  keyId: string
}

interface ApiKeyAuthFailure {
  success: false
  response: NextResponse
}

type ApiKeyAuthResult = ApiKeyAuthSuccess | ApiKeyAuthFailure

export async function withApiKey(
  request: NextRequest,
  options: ApiKeyAuthOptions
): Promise<ApiKeyAuthResult> {
  // Extract API key from header
  const authHeader = request.headers.get('authorization')
  const apiKey = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : request.headers.get('x-api-key')

  if (!apiKey) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: 'Missing API key. Use Authorization: Bearer <key> or X-API-Key header.' },
        { status: 401 }
      ),
    }
  }

  // Validate key
  const result = await validateApiKey(apiKey)

  if (!result || !result.valid) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: 'Invalid or expired API key.' },
        { status: 401 }
      ),
    }
  }

  // Check scope
  if (!hasScope(result.scopes!, options.scope)) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: `Insufficient scope. Required: ${options.scope}` },
        { status: 403 }
      ),
    }
  }

  // Rate limit by key ID
  const rateLimitResult = await rateLimit(
    `api_key:${result.keyId}`,
    RATE_LIMITS.api
  )

  if (!rateLimitResult.success) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(rateLimitResult.limit),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetTime),
          },
        }
      ),
    }
  }

  return {
    success: true,
    storeId: result.storeId!,
    scopes: result.scopes!,
    keyId: result.keyId!,
  }
}
