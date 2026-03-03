/**
 * Next.js Middleware for Authentication & Authorization
 *
 * Simplified version that handles basic auth redirects without
 * making blocking Supabase API calls that can fail on Edge runtime.
 * Also adds security headers to all responses.
 */

import { type NextRequest, NextResponse } from "next/server";
import { PUBLIC_ROUTES } from "@/lib/constants";

const CSRF_COOKIE_NAME = "csrf_token";

/**
 * Security headers to add to all responses
 * These help protect against common web vulnerabilities
 */
const securityHeaders = {
  // Prevent clickjacking
  "X-Frame-Options": "DENY",
  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",
  // Enable XSS protection in older browsers
  "X-XSS-Protection": "1; mode=block",
  // Control referrer information
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Restrict permissions/features — camera=(self) needed for barcode scanning
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
  // CSP enforced — blocks XSS, clickjacking, and data injection attacks
  // Note: 'unsafe-inline' and 'unsafe-eval' removal requires nonce-based CSP (follow-up task)
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://va.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.sentry.io https://vitals.vercel-insights.com https://va.vercel-scripts.com",
    "frame-src https://js.stripe.com",
    "font-src 'self'",
  ].join("; "),
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the route is public
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  // NOTE: This is a UX-layer redirect only — not a security boundary.
  // All API routes validate the session via supabase.auth.getUser().
  // A forged cookie only reaches the dashboard shell before API calls reject it.
  const hasAuthCookie = request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"),
    );

  // If not authenticated and trying to access protected route
  if (!hasAuthCookie && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(url);
    // Add security headers to redirects
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }

  // If authenticated and trying to access login page, redirect to home
  if (hasAuthCookie && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    const response = NextResponse.redirect(url);
    // Add security headers to redirects
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }

  // Allow the request to continue with security headers
  // Role-based access control is handled client-side in the layout/pages
  const response = NextResponse.next();

  // Add security headers to all responses
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Ensure CSRF cookie exists for state-changing requests (double-submit cookie pattern)
  if (!request.cookies.get(CSRF_COOKIE_NAME)) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const token = Array.from(array, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    response.cookies.set(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Client must read it for double-submit pattern
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });
  }

  return response;
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
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|icon\\.svg|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
