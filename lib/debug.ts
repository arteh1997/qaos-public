/**
 * Debug Logging Utility
 *
 * Conditional logging that only runs in development mode.
 * Prevents performance impact and log clutter in production.
 */

const IS_DEV = process.env.NODE_ENV === 'development'

/**
 * Debug log - only outputs in development
 */
export function debugLog(category: string, ...args: unknown[]): void {
  if (IS_DEV) {
    console.log(`[${category}]`, ...args)
  }
}

/**
 * Debug warn - only outputs in development
 */
export function debugWarn(category: string, ...args: unknown[]): void {
  if (IS_DEV) {
    console.warn(`[${category}]`, ...args)
  }
}

/**
 * Debug error - always outputs (errors should be logged even in production)
 */
export function debugError(category: string, ...args: unknown[]): void {
  console.error(`[${category}]`, ...args)
}
