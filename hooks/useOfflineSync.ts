'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { isOnline, onConnectivityChange, syncPendingOperations } from '@/lib/offline/sync'
import { getPendingCount, queueOperation, type PendingOperation } from '@/lib/offline/db'
import { useCSRF } from './useCSRF'

interface UseOfflineSyncResult {
  online: boolean
  pendingCount: number
  isSyncing: boolean
  syncNow: () => Promise<{ synced: number; failed: number; errors: string[] }>
  queueOfflineOperation: (
    type: PendingOperation['type'],
    storeId: string,
    data: Record<string, unknown>
  ) => Promise<void>
  lastSyncResult: { synced: number; failed: number; errors: string[] } | null
}

export function useOfflineSync(): UseOfflineSyncResult {
  const { csrfFetch } = useCSRF()
  const [online, setOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<{
    synced: number
    failed: number
    errors: string[]
  } | null>(null)
  const syncInProgressRef = useRef(false)

  // Track online status
  useEffect(() => {
    setOnline(isOnline())
    return onConnectivityChange((isOnlineNow) => {
      setOnline(isOnlineNow)
    })
  }, [])

  // Update pending count
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount()
      setPendingCount(count)
    } catch {
      // IndexedDB not available
    }
  }, [])

  useEffect(() => {
    refreshPendingCount()
    const interval = setInterval(refreshPendingCount, 5000)
    return () => clearInterval(interval)
  }, [refreshPendingCount])

  // Auto-sync when coming back online
  const syncNow = useCallback(async () => {
    if (syncInProgressRef.current) {
      return { synced: 0, failed: 0, errors: ['Sync already in progress'] }
    }

    syncInProgressRef.current = true
    setIsSyncing(true)

    try {
      const result = await syncPendingOperations(csrfFetch)
      setLastSyncResult(result)
      await refreshPendingCount()
      return result
    } finally {
      setIsSyncing(false)
      syncInProgressRef.current = false
    }
  }, [csrfFetch, refreshPendingCount])

  // Auto-sync when coming back online
  useEffect(() => {
    if (online && pendingCount > 0 && !syncInProgressRef.current) {
      syncNow()
    }
  }, [online, pendingCount, syncNow])

  // Queue an operation for offline sync
  const queueOfflineOperation = useCallback(
    async (
      type: PendingOperation['type'],
      storeId: string,
      data: Record<string, unknown>
    ) => {
      await queueOperation(type, storeId, data)
      await refreshPendingCount()
    },
    [refreshPendingCount]
  )

  return {
    online,
    pendingCount,
    isSyncing,
    syncNow,
    queueOfflineOperation,
    lastSyncResult,
  }
}
