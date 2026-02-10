import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Dexie with an in-memory store
const mockStore: Record<string, unknown[]> = {
  pendingOperations: [],
  inventoryCache: [],
  barcodeLookups: [],
}

let autoId = 1

function createMockTable(tableName: string) {
  return {
    add: vi.fn(async (item: Record<string, unknown>) => {
      const id = autoId++
      mockStore[tableName].push({ ...item, id })
      return id
    }),
    get: vi.fn(async (id: number) => {
      return mockStore[tableName].find((item: Record<string, unknown>) => item.id === id)
    }),
    put: vi.fn(async (item: Record<string, unknown>) => {
      const existing = mockStore[tableName].findIndex(
        (i: Record<string, unknown>) => (i as Record<string, unknown>).barcode === (item as Record<string, unknown>).barcode
      )
      if (existing >= 0) {
        mockStore[tableName][existing] = item
      } else {
        mockStore[tableName].push(item)
      }
    }),
    update: vi.fn(async (id: number, changes: Record<string, unknown>) => {
      const idx = mockStore[tableName].findIndex((i: Record<string, unknown>) => i.id === id)
      if (idx >= 0) {
        mockStore[tableName][idx] = { ...mockStore[tableName][idx] as Record<string, unknown>, ...changes }
      }
    }),
    delete: vi.fn(async (id: number) => {
      const idx = mockStore[tableName].findIndex((i: Record<string, unknown>) => i.id === id)
      if (idx >= 0) mockStore[tableName].splice(idx, 1)
    }),
    toArray: vi.fn(async () => [...mockStore[tableName]]),
    count: vi.fn(async () => mockStore[tableName].length),
    where: vi.fn((fieldOrObj: string | Record<string, unknown>) => {
      // Handle compound where like where({ barcode, storeId })
      if (typeof fieldOrObj === 'object') {
        return {
          first: vi.fn(async () =>
            mockStore[tableName].find((i: Record<string, unknown>) => {
              return Object.entries(fieldOrObj).every(
                ([k, v]) => (i as Record<string, unknown>)[k] === v
              )
            })
          ),
          toArray: vi.fn(async () =>
            mockStore[tableName].filter((i: Record<string, unknown>) => {
              return Object.entries(fieldOrObj).every(
                ([k, v]) => (i as Record<string, unknown>)[k] === v
              )
            })
          ),
        }
      }
      // Handle single-field where
      return {
        equals: vi.fn((value: unknown) => ({
          toArray: vi.fn(async () =>
            mockStore[tableName].filter(
              (i: Record<string, unknown>) => (i as Record<string, unknown>)[fieldOrObj] === value
            )
          ),
          delete: vi.fn(async () => {
            const before = mockStore[tableName].length
            mockStore[tableName] = mockStore[tableName].filter(
              (i: Record<string, unknown>) => (i as Record<string, unknown>)[fieldOrObj] !== value
            )
            return before - mockStore[tableName].length
          }),
          first: vi.fn(async () =>
            mockStore[tableName].find(
              (i: Record<string, unknown>) => (i as Record<string, unknown>)[fieldOrObj] === value
            )
          ),
        })),
      }
    }),
    bulkPut: vi.fn(async (items: unknown[]) => {
      mockStore[tableName].push(...items)
    }),
  }
}

const mockDb = {
  pendingOperations: createMockTable('pendingOperations'),
  inventoryCache: createMockTable('inventoryCache'),
  barcodeLookups: createMockTable('barcodeLookups'),
}

vi.mock('dexie', () => {
  return {
    default: class MockDexie {
      pendingOperations = mockDb.pendingOperations
      inventoryCache = mockDb.inventoryCache
      barcodeLookups = mockDb.barcodeLookups
      version() { return { stores: vi.fn() } }
    },
  }
})

describe('Offline Database', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.pendingOperations = []
    mockStore.inventoryCache = []
    mockStore.barcodeLookups = []
    autoId = 1
  })

  describe('queueOperation', () => {
    it('should add a stock_count operation to the queue', async () => {
      const { queueOperation } = await import('@/lib/offline/db')

      const id = await queueOperation('stock_count', 'store-123', {
        items: [{ inventory_item_id: 'item-1', quantity: 10 }],
      })

      expect(id).toBe(1)
      expect(mockDb.pendingOperations.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stock_count',
          storeId: 'store-123',
          retryCount: 0,
          lastError: null,
        })
      )
    })

    it('should add a stock_reception operation', async () => {
      const { queueOperation } = await import('@/lib/offline/db')

      await queueOperation('stock_reception', 'store-456', {
        items: [{ inventory_item_id: 'item-2', quantity: 25 }],
      })

      expect(mockDb.pendingOperations.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stock_reception',
          storeId: 'store-456',
        })
      )
    })

    it('should add a waste_report operation', async () => {
      const { queueOperation } = await import('@/lib/offline/db')

      await queueOperation('waste_report', 'store-789', {
        items: [{ inventory_item_id: 'item-3', quantity: 5, reason: 'expired' }],
      })

      expect(mockDb.pendingOperations.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'waste_report',
          storeId: 'store-789',
        })
      )
    })

    it('should include a createdAt timestamp', async () => {
      const { queueOperation } = await import('@/lib/offline/db')

      await queueOperation('stock_count', 'store-123', { items: [] })

      const call = mockDb.pendingOperations.add.mock.calls[0][0]
      expect(call.createdAt).toBeDefined()
      expect(new Date(call.createdAt).getTime()).toBeGreaterThan(0)
    })
  })

  describe('getPendingOperations', () => {
    it('should return all pending operations', async () => {
      const { getPendingOperations } = await import('@/lib/offline/db')

      mockStore.pendingOperations = [
        { id: 1, type: 'stock_count', storeId: 'store-1', data: {}, createdAt: '', retryCount: 0, lastError: null },
        { id: 2, type: 'stock_reception', storeId: 'store-2', data: {}, createdAt: '', retryCount: 0, lastError: null },
      ]

      const ops = await getPendingOperations()
      expect(ops).toHaveLength(2)
    })

    it('should filter by storeId when provided', async () => {
      const { getPendingOperations } = await import('@/lib/offline/db')

      mockStore.pendingOperations = [
        { id: 1, type: 'stock_count', storeId: 'store-1', data: {}, createdAt: '', retryCount: 0, lastError: null },
        { id: 2, type: 'stock_count', storeId: 'store-2', data: {}, createdAt: '', retryCount: 0, lastError: null },
      ]

      await getPendingOperations('store-1')
      expect(mockDb.pendingOperations.where).toHaveBeenCalledWith('storeId')
    })
  })

  describe('removePendingOperation', () => {
    it('should delete an operation by ID', async () => {
      const { removePendingOperation } = await import('@/lib/offline/db')

      await removePendingOperation(1)
      expect(mockDb.pendingOperations.delete).toHaveBeenCalledWith(1)
    })
  })

  describe('markOperationFailed', () => {
    it('should increment retry count and set error', async () => {
      const { markOperationFailed } = await import('@/lib/offline/db')

      mockStore.pendingOperations = [
        { id: 1, type: 'stock_count', storeId: 'store-1', data: {}, createdAt: '', retryCount: 0, lastError: null },
      ]

      await markOperationFailed(1, 'Network error')
      expect(mockDb.pendingOperations.update).toHaveBeenCalledWith(1, {
        retryCount: 1,
        lastError: 'Network error',
      })
    })
  })

  describe('cacheInventory', () => {
    it('should clear old items and add new ones', async () => {
      const { cacheInventory } = await import('@/lib/offline/db')

      const items = [
        {
          id: 'inv-1',
          storeId: 'store-1',
          inventoryItemId: 'item-1',
          name: 'Tomatoes',
          category: 'Produce',
          unitOfMeasure: 'kg',
          quantity: 50,
          parLevel: 20,
          updatedAt: new Date().toISOString(),
        },
      ]

      await cacheInventory('store-1', items)
      expect(mockDb.inventoryCache.where).toHaveBeenCalledWith('storeId')
      expect(mockDb.inventoryCache.bulkPut).toHaveBeenCalledWith(items)
    })
  })

  describe('getCachedInventory', () => {
    it('should return cached items for a store', async () => {
      const { getCachedInventory } = await import('@/lib/offline/db')

      mockStore.inventoryCache = [
        { id: 'inv-1', storeId: 'store-1', name: 'Tomatoes' },
      ]

      await getCachedInventory('store-1')
      expect(mockDb.inventoryCache.where).toHaveBeenCalledWith('storeId')
    })
  })

  describe('cacheBarcodeMapping', () => {
    it('should store a barcode lookup', async () => {
      const { cacheBarcodeMapping } = await import('@/lib/offline/db')

      const lookup = {
        barcode: '123456789',
        storeId: 'store-1',
        inventoryItemId: 'item-1',
        name: 'Tomatoes',
        unitOfMeasure: 'kg',
        updatedAt: new Date().toISOString(),
      }

      await cacheBarcodeMapping(lookup)
      expect(mockDb.barcodeLookups.put).toHaveBeenCalledWith(lookup)
    })
  })

  describe('lookupBarcode', () => {
    it('should find item by barcode and store', async () => {
      const { lookupBarcode } = await import('@/lib/offline/db')

      await lookupBarcode('123456789', 'store-1')
      expect(mockDb.barcodeLookups.where).toHaveBeenCalled()
    })
  })

  describe('getPendingCount', () => {
    it('should return the count of pending operations', async () => {
      const { getPendingCount } = await import('@/lib/offline/db')

      mockStore.pendingOperations = [
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ]

      const count = await getPendingCount()
      expect(count).toBe(3)
    })

    it('should return 0 when no operations', async () => {
      const { getPendingCount } = await import('@/lib/offline/db')

      const count = await getPendingCount()
      expect(count).toBe(0)
    })
  })
})
