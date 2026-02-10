import Dexie, { type EntityTable } from 'dexie'

/**
 * Offline database using Dexie.js (IndexedDB wrapper)
 *
 * Stores:
 * - pendingOperations: queued stock operations for offline sync
 * - inventoryCache: cached inventory data for offline access
 */

export interface PendingOperation {
  id?: number
  type: 'stock_count' | 'stock_reception' | 'waste_report'
  storeId: string
  data: Record<string, unknown>
  createdAt: string
  retryCount: number
  lastError: string | null
}

export interface CachedInventoryItem {
  id: string
  storeId: string
  inventoryItemId: string
  name: string
  category: string | null
  unitOfMeasure: string
  quantity: number
  parLevel: number | null
  updatedAt: string
}

export interface CachedBarcodeLookup {
  barcode: string
  storeId: string
  inventoryItemId: string
  name: string
  unitOfMeasure: string
  updatedAt: string
}

class InventoryDatabase extends Dexie {
  pendingOperations!: EntityTable<PendingOperation, 'id'>
  inventoryCache!: EntityTable<CachedInventoryItem, 'id'>
  barcodeLookups!: EntityTable<CachedBarcodeLookup, 'barcode'>

  constructor() {
    super('InventoryOfflineDB')

    this.version(1).stores({
      pendingOperations: '++id, type, storeId, createdAt',
      inventoryCache: 'id, storeId, inventoryItemId, name',
      barcodeLookups: 'barcode, storeId, inventoryItemId',
    })
  }
}

export const db = new InventoryDatabase()

/**
 * Add a pending operation to the sync queue
 */
export async function queueOperation(
  type: PendingOperation['type'],
  storeId: string,
  data: Record<string, unknown>
): Promise<number> {
  const id = await db.pendingOperations.add({
    type,
    storeId,
    data,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    lastError: null,
  })
  return id as number
}

/**
 * Get all pending operations for a store
 */
export async function getPendingOperations(storeId?: string): Promise<PendingOperation[]> {
  if (storeId) {
    return db.pendingOperations.where('storeId').equals(storeId).toArray()
  }
  return db.pendingOperations.toArray()
}

/**
 * Remove a pending operation after successful sync
 */
export async function removePendingOperation(id: number): Promise<void> {
  await db.pendingOperations.delete(id)
}

/**
 * Update retry count and error on a pending operation
 */
export async function markOperationFailed(id: number, error: string): Promise<void> {
  const op = await db.pendingOperations.get(id)
  if (op) {
    await db.pendingOperations.update(id, {
      retryCount: op.retryCount + 1,
      lastError: error,
    })
  }
}

/**
 * Cache inventory items for offline access
 */
export async function cacheInventory(storeId: string, items: CachedInventoryItem[]): Promise<void> {
  // Clear old items for this store
  await db.inventoryCache.where('storeId').equals(storeId).delete()
  // Add new items
  await db.inventoryCache.bulkPut(items)
}

/**
 * Get cached inventory for a store
 */
export async function getCachedInventory(storeId: string): Promise<CachedInventoryItem[]> {
  return db.inventoryCache.where('storeId').equals(storeId).toArray()
}

/**
 * Cache a barcode -> inventory item mapping
 */
export async function cacheBarcodeMapping(lookup: CachedBarcodeLookup): Promise<void> {
  await db.barcodeLookups.put(lookup)
}

/**
 * Look up an inventory item by barcode
 */
export async function lookupBarcode(barcode: string, storeId: string): Promise<CachedBarcodeLookup | undefined> {
  return db.barcodeLookups.where({ barcode, storeId }).first()
}

/**
 * Get count of pending operations
 */
export async function getPendingCount(): Promise<number> {
  return db.pendingOperations.count()
}
