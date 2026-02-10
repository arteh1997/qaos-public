import {
  getPendingOperations,
  removePendingOperation,
  markOperationFailed,
  type PendingOperation,
} from './db'

/**
 * Sync all pending operations with the server
 *
 * Returns: { synced: number, failed: number, errors: string[] }
 */
export async function syncPendingOperations(csrfFetch: (url: string, options?: RequestInit) => Promise<Response>): Promise<{
  synced: number
  failed: number
  errors: string[]
}> {
  const operations = await getPendingOperations()

  if (operations.length === 0) {
    return { synced: 0, failed: 0, errors: [] }
  }

  let synced = 0
  let failed = 0
  const errors: string[] = []

  for (const op of operations) {
    try {
      const success = await syncSingleOperation(op, csrfFetch)
      if (success) {
        await removePendingOperation(op.id!)
        synced++
      } else {
        failed++
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      errors.push(`${op.type}: ${errorMessage}`)
      await markOperationFailed(op.id!, errorMessage)
      failed++
    }
  }

  return { synced, failed, errors }
}

/**
 * Sync a single operation to the server
 */
async function syncSingleOperation(
  op: PendingOperation,
  csrfFetch: (url: string, options?: RequestInit) => Promise<Response>
): Promise<boolean> {
  const endpoints: Record<PendingOperation['type'], string> = {
    stock_count: `/api/stores/${op.storeId}/stock-count`,
    stock_reception: `/api/stores/${op.storeId}/stock-reception`,
    waste_report: `/api/stores/${op.storeId}/waste`,
  }

  const endpoint = endpoints[op.type]
  if (!endpoint) {
    throw new Error(`Unknown operation type: ${op.type}`)
  }

  const response = await csrfFetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(op.data),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({ message: 'Server error' }))
    throw new Error(data.message || `HTTP ${response.status}`)
  }

  return true
}

/**
 * Check if the browser is online
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

/**
 * Register online/offline event listeners
 */
export function onConnectivityChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}
