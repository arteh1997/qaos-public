'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface UseFormDraftOptions<T> {
  /** Unique key for this form's draft (e.g., 'stock-count-store-123') */
  key: string
  /** Initial/default values */
  defaultValue: T
  /** Debounce delay in ms before saving (default: 1000) */
  debounceMs?: number
  /** Max age in ms before draft is considered stale (default: 24 hours) */
  maxAge?: number
}

interface DraftData<T> {
  value: T
  timestamp: number
}

const DRAFT_PREFIX = 'form-draft:'

/**
 * Hook for persisting form data to localStorage with automatic recovery
 *
 * @example
 * const { value, setValue, hasDraft, clearDraft, restoreDraft } = useFormDraft({
 *   key: `stock-count-${storeId}`,
 *   defaultValue: initialItems,
 * })
 */
export function useFormDraft<T>(options: UseFormDraftOptions<T>) {
  const {
    key,
    defaultValue,
    debounceMs = 1000,
    maxAge = 24 * 60 * 60 * 1000, // 24 hours
  } = options

  const storageKey = `${DRAFT_PREFIX}${key}`
  const [value, setValueState] = useState<T>(defaultValue)
  const [hasDraft, setHasDraft] = useState(false)
  const [draftTimestamp, setDraftTimestamp] = useState<number | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const initializedRef = useRef(false)

  // Check for existing draft on mount
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const draft: DraftData<T> = JSON.parse(stored)
        const age = Date.now() - draft.timestamp

        if (age < maxAge) {
          setHasDraft(true)
          setDraftTimestamp(draft.timestamp)
        } else {
          // Draft is too old, remove it
          localStorage.removeItem(storageKey)
        }
      }
    } catch {
      // Invalid stored data, ignore
      localStorage.removeItem(storageKey)
    }
  }, [storageKey, maxAge])

  // Save draft with debounce
  const saveDraft = useCallback((newValue: T) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      try {
        const draft: DraftData<T> = {
          value: newValue,
          timestamp: Date.now(),
        }
        localStorage.setItem(storageKey, JSON.stringify(draft))
        setHasDraft(true)
        setDraftTimestamp(draft.timestamp)
      } catch {
        // Storage full or unavailable, ignore
      }
    }, debounceMs)
  }, [storageKey, debounceMs])

  // Set value and trigger draft save
  const setValue = useCallback((newValue: T | ((prev: T) => T)) => {
    setValueState(prev => {
      const updated = typeof newValue === 'function'
        ? (newValue as (prev: T) => T)(prev)
        : newValue
      saveDraft(updated)
      return updated
    })
  }, [saveDraft])

  // Restore draft to current value
  const restoreDraft = useCallback(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const draft: DraftData<T> = JSON.parse(stored)
        setValueState(draft.value)
        return draft.value
      }
    } catch {
      // Invalid stored data
    }
    return null
  }, [storageKey])

  // Clear the draft
  const clearDraft = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    localStorage.removeItem(storageKey)
    setHasDraft(false)
    setDraftTimestamp(null)
  }, [storageKey])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  return {
    value,
    setValue,
    hasDraft,
    draftTimestamp,
    restoreDraft,
    clearDraft,
  }
}

/**
 * Format draft timestamp for display
 */
export function formatDraftTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`

  return new Date(timestamp).toLocaleDateString()
}
