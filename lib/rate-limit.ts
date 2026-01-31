/**
 * Simple in-memory rate limiter using sliding window algorithm
 * Note: This is suitable for single-instance deployments.
 * For multi-instance/serverless deployments, consider using Redis-based rate limiting.
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limit tracking
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up old entries periodically (every 5 minutes)
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 5 * 60 * 1000

function cleanupOldEntries(): void {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
  lastCleanup = now
}

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number
  /** Time window in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  /** Whether the request should be allowed */
  success: boolean
  /** Number of requests remaining in the current window */
  remaining: number
  /** Unix timestamp (ms) when the rate limit resets */
  resetTime: number
  /** Total limit for this window */
  limit: number
}

/**
 * Check if a request should be rate limited
 * @param identifier Unique identifier for the rate limit (e.g., user ID, IP address)
 * @param config Rate limit configuration
 * @returns Rate limit result
 */
export function rateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupOldEntries()

  const now = Date.now()
  const key = identifier
  const entry = rateLimitStore.get(key)

  // If no existing entry or window has expired, create new entry
  if (!entry || entry.resetTime < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    }
    rateLimitStore.set(key, newEntry)

    return {
      success: true,
      remaining: config.limit - 1,
      resetTime: newEntry.resetTime,
      limit: config.limit,
    }
  }

  // Check if limit exceeded
  if (entry.count >= config.limit) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      limit: config.limit,
    }
  }

  // Increment count
  entry.count += 1
  rateLimitStore.set(key, entry)

  return {
    success: true,
    remaining: config.limit - entry.count,
    resetTime: entry.resetTime,
    limit: config.limit,
  }
}

// Preset rate limit configurations
export const RATE_LIMITS = {
  // General API endpoints
  api: { limit: 100, windowMs: 60 * 1000 }, // 100 requests per minute

  // Authentication endpoints (more restrictive)
  auth: { limit: 10, windowMs: 60 * 1000 }, // 10 requests per minute

  // User creation (very restrictive to prevent spam)
  createUser: { limit: 5, windowMs: 60 * 1000 }, // 5 requests per minute

  // Report endpoints
  reports: { limit: 20, windowMs: 60 * 1000 }, // 20 requests per minute
} as const

/**
 * Helper to generate rate limit response headers
 */
export function getRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetTime.toString(),
  }
}
