/**
 * Next.js Middleware for Authentication & Authorization
 *
 * Simplified version that handles basic auth redirects without
 * making blocking Supabase API calls that can fail on Edge runtime.
 * Also adds security headers to all responses.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { PUBLIC_ROUTES } from '@/lib/constants'

/**
 * Security headers to add to all responses
 * These help protect against common web vulnerabilities
 */
const securityHeaders = {
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  // Enable XSS protection in older browsers
  'X-XSS-Protection': '1; mode=block',
  // Control referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Restrict permissions/features
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if the route is public
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))

  // Check for Supabase auth cookie to determine if user is logged in
  // This is a lightweight check that doesn't make any API calls
  const hasAuthCookie = request.cookies.getAll().some(cookie =>
    cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')
  )

  // If not authenticated and trying to access protected route
  if (!hasAuthCookie && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    const response = NextResponse.redirect(url)
    // Add security headers to redirects
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    return response
  }

  // If authenticated and trying to access login page
  if (hasAuthCookie && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    const response = NextResponse.redirect(url)
    // Add security headers to redirects
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    return response
  }

  // Allow the request to continue with security headers
  // Role-based access control is handled client-side in the layout/pages
  const response = NextResponse.next()

  // Add security headers to all responses
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets
     * - PWA files (sw.js, manifest.json)
     * - api routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|icon\\.svg|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
