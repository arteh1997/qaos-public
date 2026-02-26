'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const GUIDE_PREFIX = 'page-guide-seen:'

/**
 * Tracks whether the user has seen a page's guide panel.
 * SSR-safe — reads localStorage only in useEffect.
 */
export function usePageGuide(pageKey: string) {
  const storageKey = `${GUIDE_PREFIX}${pageKey}`
  const [hasSeen, setHasSeen] = useState(false)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored === 'true') {
        setHasSeen(true)
      }
    } catch {
      // localStorage unavailable (SSR, private browsing)
    }
  }, [storageKey])

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(storageKey, 'true')
    } catch {
      // Ignore storage failures
    }
    setHasSeen(true)
  }, [storageKey])

  return { hasSeen, markSeen }
}
