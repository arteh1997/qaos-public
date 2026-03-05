/**
 * Debug Logging Utility
 *
 * Disabled by default. Enable via browser console: localStorage.setItem('debug', '1')
 * Then refresh the page. To disable again: localStorage.removeItem('debug')
 */

// No-op in production. In dev, opt-in via localStorage.
 
export function debugLog(_category: string, ..._args: unknown[]): void {}

 
export function debugWarn(_category: string, ..._args: unknown[]): void {}

/**
 * Debug error - always outputs (errors should be logged even in production)
 */
export function debugError(category: string, ...args: unknown[]): void {
  console.error(`[${category}]`, ...args)
}
