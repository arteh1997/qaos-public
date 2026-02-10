import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the db module
const mockGetPendingOperations = vi.fn()
const mockRemovePendingOperation = vi.fn()
const mockMarkOperationFailed = vi.fn()

vi.mock('@/lib/offline/db', () => ({
  getPendingOperations: () => mockGetPendingOperations(),
  removePendingOperation: (id: number) => mockRemovePendingOperation(id),
  markOperationFailed: (id: number, error: string) => mockMarkOperationFailed(id, error),
}))

describe('Offline Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockGetPendingOperations.mockResolvedValue([])
    mockRemovePendingOperation.mockResolvedValue(undefined)
    mockMarkOperationFailed.mockResolvedValue(undefined)
  })

  describe('syncPendingOperations', () => {
    it('should return zeros when no pending operations', async () => {
      const { syncPendingOperations } = await import('@/lib/offline/sync')

      mockGetPendingOperations.mockResolvedValue([])

      const mockFetch = vi.fn()
      const result = await syncPendingOperations(mockFetch as unknown as typeof fetch)

      expect(result).toEqual({ synced: 0, failed: 0, errors: [] })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should sync stock_count operations to correct endpoint', async () => {
      const { syncPendingOperations } = await import('@/lib/offline/sync')

      mockGetPendingOperations.mockResolvedValue([
        {
          id: 1,
          type: 'stock_count',
          storeId: 'store-123',
          data: { items: [{ inventory_item_id: 'item-1', quantity: 10 }] },
          createdAt: '2026-02-10T00:00:00Z',
          retryCount: 0,
          lastError: null,
        },
      ])

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })

      const result = await syncPendingOperations(mockFetch as unknown as typeof fetch)

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/stores/store-123/stock-count',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
      expect(result.synced).toBe(1)
      expect(result.failed).toBe(0)
      expect(mockRemovePendingOperation).toHaveBeenCalledWith(1)
    })

    it('should sync stock_reception operations to correct endpoint', async () => {
      const { syncPendingOperations } = await import('@/lib/offline/sync')

      mockGetPendingOperations.mockResolvedValue([
        {
          id: 2,
          type: 'stock_reception',
          storeId: 'store-456',
          data: { items: [{ inventory_item_id: 'item-2', quantity: 25 }] },
          createdAt: '2026-02-10T00:00:00Z',
          retryCount: 0,
          lastError: null,
        },
      ])

      const mockFetch = vi.fn().mockResolvedValue({ ok: true })

      const result = await syncPendingOperations(mockFetch as unknown as typeof fetch)

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/stores/store-456/stock-reception',
        expect.objectContaining({ method: 'POST' })
      )
      expect(result.synced).toBe(1)
    })

    it('should sync waste_report operations to correct endpoint', async () => {
      const { syncPendingOperations } = await import('@/lib/offline/sync')

      mockGetPendingOperations.mockResolvedValue([
        {
          id: 3,
          type: 'waste_report',
          storeId: 'store-789',
          data: { items: [] },
          createdAt: '2026-02-10T00:00:00Z',
          retryCount: 0,
          lastError: null,
        },
      ])

      const mockFetch = vi.fn().mockResolvedValue({ ok: true })

      const result = await syncPendingOperations(mockFetch as unknown as typeof fetch)

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/stores/store-789/waste',
        expect.objectContaining({ method: 'POST' })
      )
      expect(result.synced).toBe(1)
    })

    it('should handle failed operations and mark them', async () => {
      const { syncPendingOperations } = await import('@/lib/offline/sync')

      mockGetPendingOperations.mockResolvedValue([
        {
          id: 4,
          type: 'stock_count',
          storeId: 'store-123',
          data: {},
          createdAt: '2026-02-10T00:00:00Z',
          retryCount: 0,
          lastError: null,
        },
      ])

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Server error' }),
      })

      const result = await syncPendingOperations(mockFetch as unknown as typeof fetch)

      expect(result.synced).toBe(0)
      expect(result.failed).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('stock_count')
      expect(mockMarkOperationFailed).toHaveBeenCalledWith(4, expect.any(String))
    })

    it('should handle network errors gracefully', async () => {
      const { syncPendingOperations } = await import('@/lib/offline/sync')

      mockGetPendingOperations.mockResolvedValue([
        {
          id: 5,
          type: 'stock_count',
          storeId: 'store-123',
          data: {},
          createdAt: '2026-02-10T00:00:00Z',
          retryCount: 1,
          lastError: 'Previous error',
        },
      ])

      const mockFetch = vi.fn().mockRejectedValue(new Error('Network failed'))

      const result = await syncPendingOperations(mockFetch as unknown as typeof fetch)

      expect(result.synced).toBe(0)
      expect(result.failed).toBe(1)
      expect(result.errors).toContain('stock_count: Network failed')
      expect(mockMarkOperationFailed).toHaveBeenCalledWith(5, 'Network failed')
    })

    it('should process multiple operations', async () => {
      const { syncPendingOperations } = await import('@/lib/offline/sync')

      mockGetPendingOperations.mockResolvedValue([
        { id: 1, type: 'stock_count', storeId: 'store-1', data: {}, createdAt: '', retryCount: 0, lastError: null },
        { id: 2, type: 'stock_reception', storeId: 'store-1', data: {}, createdAt: '', retryCount: 0, lastError: null },
        { id: 3, type: 'waste_report', storeId: 'store-2', data: {}, createdAt: '', retryCount: 0, lastError: null },
      ])

      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false, status: 400, json: () => Promise.resolve({ message: 'Bad request' }) })
        .mockResolvedValueOnce({ ok: true })

      const result = await syncPendingOperations(mockFetch as unknown as typeof fetch)

      expect(result.synced).toBe(2)
      expect(result.failed).toBe(1)
      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(mockRemovePendingOperation).toHaveBeenCalledTimes(2)
    })

    it('should send operation data as JSON body', async () => {
      const { syncPendingOperations } = await import('@/lib/offline/sync')

      const operationData = {
        items: [
          { inventory_item_id: 'item-1', quantity: 10 },
          { inventory_item_id: 'item-2', quantity: 20 },
        ],
        notes: 'Test count',
      }

      mockGetPendingOperations.mockResolvedValue([
        { id: 1, type: 'stock_count', storeId: 'store-1', data: operationData, createdAt: '', retryCount: 0, lastError: null },
      ])

      const mockFetch = vi.fn().mockResolvedValue({ ok: true })

      await syncPendingOperations(mockFetch as unknown as typeof fetch)

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/stores/store-1/stock-count',
        expect.objectContaining({
          body: JSON.stringify(operationData),
        })
      )
    })
  })

  describe('isOnline', () => {
    it('should return true when navigator.onLine is true', async () => {
      const { isOnline } = await import('@/lib/offline/sync')

      // Stub navigator for Node.js test environment
      vi.stubGlobal('navigator', { onLine: true })
      expect(isOnline()).toBe(true)
      vi.unstubAllGlobals()
    })

    it('should return true when navigator is undefined', async () => {
      const { isOnline } = await import('@/lib/offline/sync')
      // In Node.js test env, navigator is undefined → isOnline() defaults to true
      vi.stubGlobal('navigator', undefined)
      expect(isOnline()).toBe(true)
      vi.unstubAllGlobals()
    })
  })

  describe('onConnectivityChange', () => {
    it('should register online and offline event listeners', async () => {
      // onConnectivityChange requires window (browser API)
      // Provide a minimal global window for this test
      const mockWindow = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }
      vi.stubGlobal('window', mockWindow)

      const { onConnectivityChange } = await import('@/lib/offline/sync')

      const callback = vi.fn()
      const cleanup = onConnectivityChange(callback)

      expect(mockWindow.addEventListener).toHaveBeenCalledWith('online', expect.any(Function))
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function))

      cleanup()
      vi.unstubAllGlobals()
    })

    it('should return a cleanup function that removes listeners', async () => {
      const mockWindow = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }
      vi.stubGlobal('window', mockWindow)

      const { onConnectivityChange } = await import('@/lib/offline/sync')

      const callback = vi.fn()
      const cleanup = onConnectivityChange(callback)
      cleanup()

      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function))
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function))

      vi.unstubAllGlobals()
    })
  })
})
