/**
 * Production-ready rate limiter using Upstash Redis with sliding window algorithm
 * Supports multi-instance/serverless deployments with true horizontal scaling
 */

import { Redis } from '@upstash/redis'
import { logger } from '@/lib/logger'

// Initialize Redis client (will be null if env vars not configured)
let redis: Redis | null = null

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  } else if (process.env.NODE_ENV === 'production') {
    logger.warn('Upstash Redis not configured. Rate limiting will use in-memory fallback.')
  }
} catch {
  // Do NOT log the error object — it may contain the Redis URL with embedded credentials
  logger.warn('Redis unavailable, using in-memory rate limiting')
}

// Fallback in-memory store for development or when Redis unavailable
interface RateLimitEntry {
  count: number
  resetTime: number
}

const fallbackStore = new Map<string, RateLimitEntry>()
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 5 * 60 * 1000

function cleanupFallbackStore(): void {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return

  for (const [key, entry] of fallbackStore.entries()) {
    if (entry.resetTime < now) {
      fallbackStore.delete(key)
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
 * Redis-based rate limiter using sliding window algorithm with sorted sets
 */
async function rateLimitRedis(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now()
  const windowStart = now - config.windowMs
  const key = `ratelimit:${identifier}`

  try {
    // Use Redis pipeline for atomic operations
    const pipeline = redis!.pipeline()

    // Remove old entries outside the sliding window
    pipeline.zremrangebyscore(key, 0, windowStart)

    // Add current timestamp to sorted set
    pipeline.zadd(key, { score: now, member: `${now}-${Math.random()}` })

    // Count requests in current window
    pipeline.zcard(key)

    // Set expiration on the key (cleanup)
    pipeline.expire(key, Math.ceil(config.windowMs / 1000))

    // Execute pipeline
    const results = await pipeline.exec()

    // Extract count from ZCARD result (3rd command, index 2)
    const count = results[2] as number

    // Check if limit exceeded
    const success = count <= config.limit
    const remaining = Math.max(0, config.limit - count)

    // Calculate reset time (end of current window)
    const resetTime = now + config.windowMs

    return {
      success,
      remaining,
      resetTime,
      limit: config.limit,
    }
  } catch (error) {
    logger.error('Redis rate limit error:', error)
    // Fall back to in-memory on Redis errors
    return rateLimitFallback(identifier, config)
  }
}

/**
 * Fallback in-memory rate limiter (for development or Redis unavailable)
 */
function rateLimitFallback(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupFallbackStore()

  const now = Date.now()
  const key = identifier
  const entry = fallbackStore.get(key)

  // If no existing entry or window has expired, create new entry
  if (!entry || entry.resetTime < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    }
    fallbackStore.set(key, newEntry)

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
  fallbackStore.set(key, entry)

  return {
    success: true,
    remaining: config.limit - entry.count,
    resetTime: entry.resetTime,
    limit: config.limit,
  }
}

/**
 * Check if a request should be rate limited
 * @param identifier Unique identifier for the rate limit (e.g., user ID, IP address)
 * @param config Rate limit configuration
 * @returns Rate limit result
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Skip rate limiting in development — no reason to throttle localhost
  if (process.env.NODE_ENV === 'development') {
    return {
      success: true,
      remaining: config.limit,
      resetTime: Date.now() + config.windowMs,
      limit: config.limit,
    }
  }

  // Use Redis if available, otherwise fall back to in-memory
  if (redis) {
    return rateLimitRedis(identifier, config)
  }

  return rateLimitFallback(identifier, config)
}

// Preset rate limit configurations
export const RATE_LIMITS = {
  // General API endpoints (dashboard pages fire 3-5 parallel queries per navigation)
  api: { limit: 200, windowMs: 60 * 1000 }, // 200 requests per minute

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
