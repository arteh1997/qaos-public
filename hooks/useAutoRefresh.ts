'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface UseAutoRefreshOptions {
  /** Interval in milliseconds (default: 60000 = 1 minute) */
  interval?: number
  /** Whether auto-refresh is enabled (default: true) */
  enabled?: boolean
  /** Callback function to execute on each refresh */
  onRefresh: () => void | Promise<void>
}

/**
 * Hook for auto-refreshing data at a specified interval
 *
 * Features:
 * - Pauses when tab is not visible (saves resources)
 * - Immediate refresh when tab becomes visible again
 * - Manual refresh trigger
 * - Toggle auto-refresh on/off
 */
export function useAutoRefresh({
  interval = 60000, // 1 minute default
  enabled = true,
  onRefresh,
}: UseAutoRefreshOptions) {
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(enabled)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const refresh = useCallback(async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    try {
      await onRefresh()
      setLastRefreshed(new Date())
    } finally {
      setIsRefreshing(false)
    }
  }, [onRefresh, isRefreshing])

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAutoRefreshEnabled) {
        // Refresh immediately when tab becomes visible
        refresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAutoRefreshEnabled, refresh])

  // Set up interval
  useEffect(() => {
    if (!isAutoRefreshEnabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Only refresh when tab is visible
    intervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }, interval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isAutoRefreshEnabled, interval, refresh])

  const toggleAutoRefresh = useCallback(() => {
    setIsAutoRefreshEnabled(prev => !prev)
  }, [])

  return {
    isAutoRefreshEnabled,
    setIsAutoRefreshEnabled,
    toggleAutoRefresh,
    lastRefreshed,
    isRefreshing,
    refresh,
  }
}
