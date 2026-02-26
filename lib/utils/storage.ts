/**
 * Safe localStorage wrappers that handle restricted browser environments
 * (incognito mode, storage quota exceeded, third-party cookie blocking).
 */

export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage quota exceeded or access denied — silently fail
  }
}

export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Access denied — silently fail
  }
}
