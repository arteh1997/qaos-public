import { describe, it, expect } from 'vitest'
import {
  createSupplierSchema,
  updateSupplierSchema,
  supplierItemSchema,
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  receivePurchaseOrderSchema,
} from '@/lib/validations/suppliers'

const validUuid = '123e4567-e89b-12d3-a456-426614174000'
const validUuid2 = '550e8400-e29b-41d4-a716-446655440000'

describe('Supplier Validation Schemas', () => {
  describe('createSupplierSchema', () => {
    it('should accept valid supplier with all fields', () => {
      const result = createSupplierSchema.safeParse({
        name: 'Fresh Foods Co',
        email: 'orders@freshfoods.com',
        phone: '+1-555-0100',
        address: '123 Market St, NY 10001',
        contact_person: 'John Smith',
        payment_terms: 'Net 30',
        notes: 'Preferred produce supplier',
      })
      expect(result.success).toBe(true)
    })

    it('should accept minimal supplier', () => {
      const result = createSupplierSchema.safeParse({ name: 'Quick Supply' })
      expect(result.success).toBe(true)
    })

    it('should accept empty optional strings', () => {
      const result = createSupplierSchema.safeParse({
        name: 'Test',
        email: '',
        phone: '',
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty name', () => {
      const result = createSupplierSchema.safeParse({ name: '' })
      expect(result.success).toBe(false)
    })

    it('should reject name over 100 characters', () => {
      const result = createSupplierSchema.safeParse({ name: 'A'.repeat(101) })
      expect(result.success).toBe(false)
    })

    it('should reject invalid email', () => {
      const result = createSupplierSchema.safeParse({
        name: 'Test',
        email: 'not-an-email',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('updateSupplierSchema', () => {
    it('should accept partial update', () => {
      const result = updateSupplierSchema.safeParse({ name: 'Updated Name' })
      expect(result.success).toBe(true)
    })

    it('should accept empty update', () => {
      const result = updateSupplierSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe('supplierItemSchema', () => {
    it('should accept valid supplier item', () => {
      const result = supplierItemSchema.safeParse({
        inventory_item_id: validUuid,
        unit_cost: 5.50,
        currency: 'USD',
        lead_time_days: 3,
        min_order_quantity: 10,
      })
      expect(result.success).toBe(true)
    })

    it('should accept with SKU', () => {
      const result = supplierItemSchema.safeParse({
        inventory_item_id: validUuid,
        unit_cost: 2.99,
        supplier_sku: 'TOM-001',
      })
      expect(result.success).toBe(true)
    })

    it('should reject negative unit cost', () => {
      const result = supplierItemSchema.safeParse({
        inventory_item_id: validUuid,
        unit_cost: -1,
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid UUID', () => {
      const result = supplierItemSchema.safeParse({
        inventory_item_id: 'not-a-uuid',
        unit_cost: 5,
      })
      expect(result.success).toBe(false)
    })

    it('should accept zero cost', () => {
      const result = supplierItemSchema.safeParse({
        inventory_item_id: validUuid,
        unit_cost: 0,
      })
      expect(result.success).toBe(true)
    })

    it('should reject negative lead time', () => {
      const result = supplierItemSchema.safeParse({
        inventory_item_id: validUuid,
        unit_cost: 5,
        lead_time_days: -1,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('createPurchaseOrderSchema', () => {
    it('should accept valid purchase order', () => {
      const result = createPurchaseOrderSchema.safeParse({
        supplier_id: validUuid,
        order_date: '2026-02-10',
        expected_delivery_date: '2026-02-15',
        items: [
          { inventory_item_id: validUuid, quantity_ordered: 100, unit_price: 2.50 },
          { inventory_item_id: validUuid2, quantity_ordered: 50, unit_price: 5.00 },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty items', () => {
      const result = createPurchaseOrderSchema.safeParse({
        supplier_id: validUuid,
        items: [],
      })
      expect(result.success).toBe(false)
    })

    it('should reject zero quantity', () => {
      const result = createPurchaseOrderSchema.safeParse({
        supplier_id: validUuid,
        items: [{ inventory_item_id: validUuid, quantity_ordered: 0, unit_price: 5 }],
      })
      expect(result.success).toBe(false)
    })

    it('should reject negative unit price', () => {
      const result = createPurchaseOrderSchema.safeParse({
        supplier_id: validUuid,
        items: [{ inventory_item_id: validUuid, quantity_ordered: 10, unit_price: -5 }],
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid supplier UUID', () => {
      const result = createPurchaseOrderSchema.safeParse({
        supplier_id: 'bad',
        items: [{ inventory_item_id: validUuid, quantity_ordered: 10, unit_price: 5 }],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('updatePurchaseOrderSchema', () => {
    it('should accept valid status update', () => {
      const result = updatePurchaseOrderSchema.safeParse({ status: 'submitted' })
      expect(result.success).toBe(true)
    })

    it('should reject invalid status', () => {
      const result = updatePurchaseOrderSchema.safeParse({ status: 'invalid' })
      expect(result.success).toBe(false)
    })

    it('should accept notes update', () => {
      const result = updatePurchaseOrderSchema.safeParse({ notes: 'Updated notes' })
      expect(result.success).toBe(true)
    })
  })

  describe('receivePurchaseOrderSchema', () => {
    it('should accept valid receive data', () => {
      const result = receivePurchaseOrderSchema.safeParse({
        items: [
          { purchase_order_item_id: validUuid, quantity_received: 50 },
          { purchase_order_item_id: validUuid2, quantity_received: 25 },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty items', () => {
      const result = receivePurchaseOrderSchema.safeParse({ items: [] })
      expect(result.success).toBe(false)
    })

    it('should reject negative quantity', () => {
      const result = receivePurchaseOrderSchema.safeParse({
        items: [{ purchase_order_item_id: validUuid, quantity_received: -5 }],
      })
      expect(result.success).toBe(false)
    })

    it('should accept with notes', () => {
      const result = receivePurchaseOrderSchema.safeParse({
        items: [{ purchase_order_item_id: validUuid, quantity_received: 10 }],
        notes: 'Partial delivery',
      })
      expect(result.success).toBe(true)
    })
  })
})
