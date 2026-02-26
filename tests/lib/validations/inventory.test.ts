import { describe, it, expect } from 'vitest'
import {
  inventoryItemSchema,
  storeInventorySchema,
  stockCountSchema,
  stockReceptionSchema,
  wasteReportSchema,
} from '@/lib/validations/inventory'

// Valid UUIDs for testing
const validUuid = '123e4567-e89b-12d3-a456-426614174000'
const validUuid2 = '550e8400-e29b-41d4-a716-446655440000'

describe('Inventory Validation Schemas', () => {
  describe('inventoryItemSchema', () => {
    describe('Valid Inputs', () => {
      it('should accept valid inventory item with all fields', () => {
        const result = inventoryItemSchema.safeParse({
          store_id: validUuid,
          name: 'Tomatoes',
          category: 'Produce',
          unit_of_measure: 'lb',
          is_active: true,
        })
        expect(result.success).toBe(true)
      })

      it('should accept item without category (optional)', () => {
        const result = inventoryItemSchema.safeParse({
          store_id: validUuid,
          name: 'Custom Item',
          unit_of_measure: 'each',
          is_active: true,
        })
        expect(result.success).toBe(true)
      })

      it('should accept minimum length name (2 characters)', () => {
        const result = inventoryItemSchema.safeParse({
          store_id: validUuid,
          name: 'AB',
          unit_of_measure: 'kg',
          is_active: false,
        })
        expect(result.success).toBe(true)
      })
    })

    describe('Invalid Inputs', () => {
      it('should reject name shorter than 2 characters', () => {
        const result = inventoryItemSchema.safeParse({
          store_id: validUuid,
          name: 'A',
          unit_of_measure: 'lb',
          is_active: true,
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe(
            'Item name must be at least 2 characters'
          )
        }
      })

      it('should reject empty name', () => {
        const result = inventoryItemSchema.safeParse({
          store_id: validUuid,
          name: '',
          unit_of_measure: 'lb',
          is_active: true,
        })
        expect(result.success).toBe(false)
      })

      it('should accept empty unit_of_measure', () => {
        const result = inventoryItemSchema.safeParse({
          store_id: validUuid,
          name: 'Tomatoes',
          unit_of_measure: '',
          is_active: true,
        })
        expect(result.success).toBe(true)
      })

      it('should reject missing is_active', () => {
        const result = inventoryItemSchema.safeParse({
          store_id: validUuid,
          name: 'Tomatoes',
          unit_of_measure: 'lb',
        })
        expect(result.success).toBe(false) // is_active is required
      })

      it('should reject non-boolean is_active', () => {
        const result = inventoryItemSchema.safeParse({
          store_id: validUuid,
          name: 'Tomatoes',
          unit_of_measure: 'lb',
          is_active: 'yes',
        })
        expect(result.success).toBe(false)
      })
    })
  })

  describe('storeInventorySchema', () => {
    describe('Valid Inputs', () => {
      it('should accept valid store inventory', () => {
        const result = storeInventorySchema.safeParse({
          store_id: validUuid,
          inventory_item_id: validUuid2,
          quantity: 100,
          par_level: 50,
        })
        expect(result.success).toBe(true)
      })

      it('should accept zero quantity', () => {
        const result = storeInventorySchema.safeParse({
          store_id: validUuid,
          inventory_item_id: validUuid2,
          quantity: 0,
        })
        expect(result.success).toBe(true)
      })

      it('should accept without par_level (optional)', () => {
        const result = storeInventorySchema.safeParse({
          store_id: validUuid,
          inventory_item_id: validUuid2,
          quantity: 25,
        })
        expect(result.success).toBe(true)
      })

      it('should accept zero par_level', () => {
        const result = storeInventorySchema.safeParse({
          store_id: validUuid,
          inventory_item_id: validUuid2,
          quantity: 10,
          par_level: 0,
        })
        expect(result.success).toBe(true)
      })
    })

    describe('Invalid Inputs', () => {
      it('should reject invalid store_id UUID', () => {
        const result = storeInventorySchema.safeParse({
          store_id: 'invalid-uuid',
          inventory_item_id: validUuid,
          quantity: 10,
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Invalid store')
        }
      })

      it('should reject invalid inventory_item_id UUID', () => {
        const result = storeInventorySchema.safeParse({
          store_id: validUuid,
          inventory_item_id: 'not-a-uuid',
          quantity: 10,
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Invalid inventory item')
        }
      })

      it('should reject negative quantity', () => {
        const result = storeInventorySchema.safeParse({
          store_id: validUuid,
          inventory_item_id: validUuid2,
          quantity: -5,
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Quantity cannot be negative')
        }
      })

      it('should reject negative par_level', () => {
        const result = storeInventorySchema.safeParse({
          store_id: validUuid,
          inventory_item_id: validUuid2,
          quantity: 10,
          par_level: -1,
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('PAR level cannot be negative')
        }
      })
    })
  })

  describe('stockCountSchema', () => {
    describe('Valid Inputs', () => {
      it('should accept valid stock count with items', () => {
        const result = stockCountSchema.safeParse({
          store_id: validUuid,
          items: [
            { inventory_item_id: validUuid, quantity: 50 },
            { inventory_item_id: validUuid2, quantity: 25 },
          ],
        })
        expect(result.success).toBe(true)
      })

      it('should accept empty items array', () => {
        const result = stockCountSchema.safeParse({
          store_id: validUuid,
          items: [],
        })
        expect(result.success).toBe(true)
      })

      it('should accept with optional notes', () => {
        const result = stockCountSchema.safeParse({
          store_id: validUuid,
          items: [{ inventory_item_id: validUuid, quantity: 100 }],
          notes: 'End of day count',
        })
        expect(result.success).toBe(true)
      })

      it('should accept zero quantity items', () => {
        const result = stockCountSchema.safeParse({
          store_id: validUuid,
          items: [{ inventory_item_id: validUuid, quantity: 0 }],
        })
        expect(result.success).toBe(true)
      })
    })

    describe('Invalid Inputs', () => {
      it('should reject invalid store_id', () => {
        const result = stockCountSchema.safeParse({
          store_id: 'bad-id',
          items: [],
        })
        expect(result.success).toBe(false)
      })

      it('should reject negative quantity in items', () => {
        const result = stockCountSchema.safeParse({
          store_id: validUuid,
          items: [{ inventory_item_id: validUuid, quantity: -10 }],
        })
        expect(result.success).toBe(false)
      })

      it('should reject invalid inventory_item_id in items', () => {
        const result = stockCountSchema.safeParse({
          store_id: validUuid,
          items: [{ inventory_item_id: 'bad', quantity: 10 }],
        })
        expect(result.success).toBe(false)
      })

      it('should reject missing items array', () => {
        const result = stockCountSchema.safeParse({
          store_id: validUuid,
        })
        expect(result.success).toBe(false)
      })
    })
  })

  describe('stockReceptionSchema', () => {
    describe('Valid Inputs', () => {
      it('should accept valid stock reception', () => {
        const result = stockReceptionSchema.safeParse({
          store_id: validUuid,
          items: [
            { inventory_item_id: validUuid, quantity: 100 },
            { inventory_item_id: validUuid2, quantity: 50 },
          ],
        })
        expect(result.success).toBe(true)
      })

      it('should accept with notes', () => {
        const result = stockReceptionSchema.safeParse({
          store_id: validUuid,
          items: [{ inventory_item_id: validUuid, quantity: 25 }],
          notes: 'Delivery from supplier ABC',
        })
        expect(result.success).toBe(true)
      })

      it('should accept items with optional total_cost', () => {
        const result = stockReceptionSchema.safeParse({
          store_id: validUuid,
          items: [
            { inventory_item_id: validUuid, quantity: 50, total_cost: 20 },
          ],
        })
        expect(result.success).toBe(true)
      })

      it('should accept items without total_cost (optional)', () => {
        const result = stockReceptionSchema.safeParse({
          store_id: validUuid,
          items: [
            { inventory_item_id: validUuid, quantity: 10 },
          ],
        })
        expect(result.success).toBe(true)
      })

      it('should accept total_cost of zero (free items)', () => {
        const result = stockReceptionSchema.safeParse({
          store_id: validUuid,
          items: [
            { inventory_item_id: validUuid, quantity: 5, total_cost: 0 },
          ],
        })
        expect(result.success).toBe(true)
      })
    })

    describe('Invalid Inputs', () => {
      it('should reject empty items array', () => {
        const result = stockReceptionSchema.safeParse({
          store_id: validUuid,
          items: [],
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('At least one item is required')
        }
      })

      it('should reject invalid store_id', () => {
        const result = stockReceptionSchema.safeParse({
          store_id: 'invalid',
          items: [{ inventory_item_id: validUuid, quantity: 10 }],
        })
        expect(result.success).toBe(false)
      })

      it('should reject negative quantity', () => {
        const result = stockReceptionSchema.safeParse({
          store_id: validUuid,
          items: [{ inventory_item_id: validUuid, quantity: -5 }],
        })
        expect(result.success).toBe(false)
      })

      it('should reject missing store_id', () => {
        const result = stockReceptionSchema.safeParse({
          items: [{ inventory_item_id: validUuid, quantity: 10 }],
        })
        expect(result.success).toBe(false)
      })

      it('should reject negative total_cost', () => {
        const result = stockReceptionSchema.safeParse({
          store_id: validUuid,
          items: [
            { inventory_item_id: validUuid, quantity: 10, total_cost: -5 },
          ],
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Cost cannot be negative')
        }
      })
    })
  })

  describe('wasteReportSchema', () => {
    describe('Valid Inputs', () => {
      it('should accept valid waste report with reason', () => {
        const result = wasteReportSchema.safeParse({
          store_id: validUuid,
          items: [
            { inventory_item_id: validUuid, quantity: 5, reason: 'spoilage' },
            { inventory_item_id: validUuid2, quantity: 3, reason: 'expired' },
          ],
        })
        expect(result.success).toBe(true)
      })

      it('should accept waste report without reason (optional)', () => {
        const result = wasteReportSchema.safeParse({
          store_id: validUuid,
          items: [{ inventory_item_id: validUuid, quantity: 2 }],
        })
        expect(result.success).toBe(true)
      })

      it('should accept all valid reasons', () => {
        const reasons = ['spoilage', 'damaged', 'expired', 'overproduction', 'other']
        for (const reason of reasons) {
          const result = wasteReportSchema.safeParse({
            store_id: validUuid,
            items: [{ inventory_item_id: validUuid, quantity: 1, reason }],
          })
          expect(result.success).toBe(true)
        }
      })

      it('should accept with optional notes', () => {
        const result = wasteReportSchema.safeParse({
          store_id: validUuid,
          items: [{ inventory_item_id: validUuid, quantity: 1, reason: 'damaged' }],
          notes: 'Dropped during transport',
        })
        expect(result.success).toBe(true)
      })

      it('should accept zero quantity items', () => {
        const result = wasteReportSchema.safeParse({
          store_id: validUuid,
          items: [{ inventory_item_id: validUuid, quantity: 0 }],
        })
        expect(result.success).toBe(true)
      })
    })

    describe('Invalid Inputs', () => {
      it('should reject empty items array', () => {
        const result = wasteReportSchema.safeParse({
          store_id: validUuid,
          items: [],
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('At least one item is required')
        }
      })

      it('should reject invalid reason', () => {
        const result = wasteReportSchema.safeParse({
          store_id: validUuid,
          items: [{ inventory_item_id: validUuid, quantity: 1, reason: 'invalid_reason' }],
        })
        expect(result.success).toBe(false)
      })

      it('should reject negative quantity', () => {
        const result = wasteReportSchema.safeParse({
          store_id: validUuid,
          items: [{ inventory_item_id: validUuid, quantity: -3, reason: 'spoilage' }],
        })
        expect(result.success).toBe(false)
      })

      it('should reject invalid store_id', () => {
        const result = wasteReportSchema.safeParse({
          store_id: 'not-a-uuid',
          items: [{ inventory_item_id: validUuid, quantity: 1 }],
        })
        expect(result.success).toBe(false)
      })

      it('should reject invalid inventory_item_id', () => {
        const result = wasteReportSchema.safeParse({
          store_id: validUuid,
          items: [{ inventory_item_id: 'bad-id', quantity: 1, reason: 'spoilage' }],
        })
        expect(result.success).toBe(false)
      })

      it('should reject missing items', () => {
        const result = wasteReportSchema.safeParse({
          store_id: validUuid,
        })
        expect(result.success).toBe(false)
      })
    })
  })
})
