import { NextRequest, NextResponse } from 'next/server'
import { validatePortalToken } from '@/lib/services/supplier-portal'
import { logPortalActivity } from '@/lib/services/supplier-portal'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import type { SupplierPortalPermission } from '@/types'

/**
 * Middleware for supplier-portal token-authenticated routes.
 *
 * Usage:
 *   const auth = await withSupplierAuth(request, { permission: 'can_view_orders' })
 *   if (!auth.success) return auth.response
 *   // Use auth.supplierId, auth.storeId, auth.permissions
 */

interface SupplierAuthOptions {
  permission?: SupplierPortalPermission
}

interface SupplierAuthSuccess {
  success: true
  tokenId: string
  supplierId: string
  storeId: string
  supplierName: string
  permissions: Record<SupplierPortalPermission, boolean>
}

interface SupplierAuthFailure {
  success: false
  response: NextResponse
}

type SupplierAuthResult = SupplierAuthSuccess | SupplierAuthFailure

export async function withSupplierAuth(
  request: NextRequest,
  options: SupplierAuthOptions = {}
): Promise<SupplierAuthResult> {
  // Extract token from Authorization header
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : request.headers.get('x-portal-token')

  if (!token) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: 'Missing portal token. Use Authorization: Bearer <token> header.' },
        { status: 401 }
      ),
    }
  }

  // Validate token
  const result = await validatePortalToken(token)

  if (!result || !result.valid) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: 'Invalid or expired portal token.' },
        { status: 401 }
      ),
    }
  }

  // Check specific permission if required
  if (options.permission && !result.permissions![options.permission]) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: `Insufficient permission: ${options.permission}` },
        { status: 403 }
      ),
    }
  }

  // Rate limit by token ID
  const rateLimitResult = await rateLimit(
    `supplier_portal:${result.tokenId}`,
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

  // Log activity (fire and forget)
  logPortalActivity({
    supplierId: result.supplierId!,
    storeId: result.storeId!,
    tokenId: result.tokenId,
    action: 'portal.api_request',
    details: {
      method: request.method,
      path: request.nextUrl.pathname,
    },
    ipAddress: request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: request.headers.get('user-agent'),
  })

  return {
    success: true,
    tokenId: result.tokenId!,
    supplierId: result.supplierId!,
    storeId: result.storeId!,
    supplierName: result.supplierName!,
    permissions: result.permissions!,
  }
}
