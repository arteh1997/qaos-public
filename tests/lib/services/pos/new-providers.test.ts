import { describe, it, expect } from 'vitest'
import crypto from 'crypto'

import {
  validateFoodicsSignature,
  validateOracleMicrosSignature,
  validateNcrVoyixSignature,
  validateSpotOnSignature,
  validateRevelSignature,
  validateTouchBistroSignature,
  validateGastrofixSignature,
  validateIikoSignature,
  validatePosRocketSignature,
} from '@/lib/services/pos/webhook-validators'

import { foodicsAdapter } from '@/lib/services/pos/adapters/foodics'
import { oracleMicrosAdapter } from '@/lib/services/pos/adapters/oracle-micros'
import { ncrVoyixAdapter } from '@/lib/services/pos/adapters/ncr-voyix'
import { spotOnAdapter } from '@/lib/services/pos/adapters/spoton'
import { revelAdapter } from '@/lib/services/pos/adapters/revel'
import { touchBistroAdapter } from '@/lib/services/pos/adapters/touchbistro'
import { gastrofixAdapter } from '@/lib/services/pos/adapters/gastrofix'
import { iikoAdapter } from '@/lib/services/pos/adapters/iiko'
import { posRocketAdapter } from '@/lib/services/pos/adapters/posrocket'

// ── Helpers ──────────────────────────────────────────────────────────────────

function hmacHex(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

const TEST_SECRET = 'whsec_test_secret_key_12345'
const TEST_PAYLOAD = JSON.stringify({
  type: 'payment.completed',
  merchant_id: 'store_abc',
  data: { order_id: 'order_123', amount: 2499 },
})

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1: Webhook Signature Validators
// ═══════════════════════════════════════════════════════════════════════════════

describe('validateFoodicsSignature', () => {
  it('should accept a valid hex signature', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateFoodicsSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true)
  })

  it('should return false for an invalid signature (same-length hex)', () => {
    const wrongSig = hmacHex('different-payload-for-foodics', TEST_SECRET)
    expect(validateFoodicsSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(false)
  })

  it('should return false for a tampered payload', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    const tampered = TEST_PAYLOAD.replace('order_123', 'order_hacked')
    expect(validateFoodicsSignature(tampered, sig, TEST_SECRET)).toBe(false)
  })

  it('should return false when a wrong secret is used', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateFoodicsSignature(TEST_PAYLOAD, sig, 'wrong_secret')).toBe(false)
  })

  it('should throw for an empty signature (length mismatch)', () => {
    expect(() =>
      validateFoodicsSignature(TEST_PAYLOAD, '', TEST_SECRET)
    ).toThrow()
  })
})

describe('validateOracleMicrosSignature', () => {
  it('should accept a valid hex signature', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateOracleMicrosSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true)
  })

  it('should return false for an invalid signature (same-length hex)', () => {
    const wrongSig = hmacHex('different-payload-for-oracle', TEST_SECRET)
    expect(validateOracleMicrosSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(false)
  })

  it('should return false for a tampered payload', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    const tampered = TEST_PAYLOAD.replace('store_abc', 'store_evil')
    expect(validateOracleMicrosSignature(tampered, sig, TEST_SECRET)).toBe(false)
  })

  it('should return false when a wrong secret is used', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateOracleMicrosSignature(TEST_PAYLOAD, sig, 'oracle_wrong_key')).toBe(false)
  })

  it('should throw for an empty signature (length mismatch)', () => {
    expect(() =>
      validateOracleMicrosSignature(TEST_PAYLOAD, '', TEST_SECRET)
    ).toThrow()
  })
})

describe('validateNcrVoyixSignature', () => {
  it('should accept a valid hex signature', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateNcrVoyixSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true)
  })

  it('should return false for an invalid signature (same-length hex)', () => {
    const wrongSig = hmacHex('different-payload-for-ncr', TEST_SECRET)
    expect(validateNcrVoyixSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(false)
  })

  it('should return false for a tampered payload', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    const tampered = TEST_PAYLOAD.replace('2499', '1')
    expect(validateNcrVoyixSignature(tampered, sig, TEST_SECRET)).toBe(false)
  })

  it('should return false when a wrong secret is used', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateNcrVoyixSignature(TEST_PAYLOAD, sig, 'ncr_bad_key')).toBe(false)
  })

  it('should throw for an empty signature (length mismatch)', () => {
    expect(() =>
      validateNcrVoyixSignature(TEST_PAYLOAD, '', TEST_SECRET)
    ).toThrow()
  })
})

describe('validateSpotOnSignature', () => {
  it('should accept a valid hex signature', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateSpotOnSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true)
  })

  it('should return false for an invalid signature (same-length hex)', () => {
    const wrongSig = hmacHex('different-payload-for-spoton', TEST_SECRET)
    expect(validateSpotOnSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(false)
  })

  it('should return false for a tampered payload', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    const tampered = TEST_PAYLOAD.replace('payment.completed', 'payment.refunded')
    expect(validateSpotOnSignature(tampered, sig, TEST_SECRET)).toBe(false)
  })

  it('should return false when a wrong secret is used', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateSpotOnSignature(TEST_PAYLOAD, sig, 'spoton_wrong')).toBe(false)
  })

  it('should throw for an empty signature (length mismatch)', () => {
    expect(() =>
      validateSpotOnSignature(TEST_PAYLOAD, '', TEST_SECRET)
    ).toThrow()
  })
})

describe('validateRevelSignature', () => {
  it('should accept a valid hex signature', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateRevelSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true)
  })

  it('should return false for an invalid signature (same-length hex)', () => {
    const wrongSig = hmacHex('different-payload-for-revel', TEST_SECRET)
    expect(validateRevelSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(false)
  })

  it('should return false for a tampered payload', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    const tampered = TEST_PAYLOAD.replace('merchant_id', 'attacker_id')
    expect(validateRevelSignature(tampered, sig, TEST_SECRET)).toBe(false)
  })

  it('should return false when a wrong secret is used', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateRevelSignature(TEST_PAYLOAD, sig, 'revel_compromised')).toBe(false)
  })

  it('should throw for an empty signature (length mismatch)', () => {
    expect(() =>
      validateRevelSignature(TEST_PAYLOAD, '', TEST_SECRET)
    ).toThrow()
  })
})

describe('validateTouchBistroSignature', () => {
  it('should accept a valid hex signature', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateTouchBistroSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true)
  })

  it('should return false for an invalid signature (same-length hex)', () => {
    const wrongSig = hmacHex('different-payload-for-touchbistro', TEST_SECRET)
    expect(validateTouchBistroSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(false)
  })

  it('should return false for a tampered payload', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    const tampered = TEST_PAYLOAD.replace('order_123', 'order_tampered')
    expect(validateTouchBistroSignature(tampered, sig, TEST_SECRET)).toBe(false)
  })

  it('should return false when a wrong secret is used', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateTouchBistroSignature(TEST_PAYLOAD, sig, 'tb_leaked_key')).toBe(false)
  })

  it('should throw for an empty signature (length mismatch)', () => {
    expect(() =>
      validateTouchBistroSignature(TEST_PAYLOAD, '', TEST_SECRET)
    ).toThrow()
  })
})

describe('validateGastrofixSignature', () => {
  it('should accept a valid hex signature', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateGastrofixSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true)
  })

  it('should return false for an invalid signature (same-length hex)', () => {
    const wrongSig = hmacHex('different-payload-for-gastrofix', TEST_SECRET)
    expect(validateGastrofixSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(false)
  })

  it('should return false for a tampered payload', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    const tampered = TEST_PAYLOAD.replace('store_abc', 'store_manipulated')
    expect(validateGastrofixSignature(tampered, sig, TEST_SECRET)).toBe(false)
  })

  it('should return false when a wrong secret is used', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateGastrofixSignature(TEST_PAYLOAD, sig, 'gf_old_secret')).toBe(false)
  })

  it('should throw for an empty signature (length mismatch)', () => {
    expect(() =>
      validateGastrofixSignature(TEST_PAYLOAD, '', TEST_SECRET)
    ).toThrow()
  })
})

describe('validateIikoSignature', () => {
  it('should accept a valid hex signature', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateIikoSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true)
  })

  it('should return false for an invalid signature (same-length hex)', () => {
    const wrongSig = hmacHex('different-payload-for-iiko', TEST_SECRET)
    expect(validateIikoSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(false)
  })

  it('should return false for a tampered payload', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    const tampered = TEST_PAYLOAD.replace('2499', '9999')
    expect(validateIikoSignature(tampered, sig, TEST_SECRET)).toBe(false)
  })

  it('should return false when a wrong secret is used', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateIikoSignature(TEST_PAYLOAD, sig, 'iiko_expired_key')).toBe(false)
  })

  it('should throw for an empty signature (length mismatch)', () => {
    expect(() =>
      validateIikoSignature(TEST_PAYLOAD, '', TEST_SECRET)
    ).toThrow()
  })
})

describe('validatePosRocketSignature', () => {
  it('should accept a valid hex signature', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validatePosRocketSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true)
  })

  it('should return false for an invalid signature (same-length hex)', () => {
    const wrongSig = hmacHex('different-payload-for-posrocket', TEST_SECRET)
    expect(validatePosRocketSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(false)
  })

  it('should return false for a tampered payload', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    const tampered = TEST_PAYLOAD.replace('payment.completed', 'payment.failed')
    expect(validatePosRocketSignature(tampered, sig, TEST_SECRET)).toBe(false)
  })

  it('should return false when a wrong secret is used', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validatePosRocketSignature(TEST_PAYLOAD, sig, 'pr_rotated_secret')).toBe(false)
  })

  it('should throw for an empty signature (length mismatch)', () => {
    expect(() =>
      validatePosRocketSignature(TEST_PAYLOAD, '', TEST_SECRET)
    ).toThrow()
  })
})

// ── Cross-cutting: all 9 new hex validators accept the same signature ────────

describe('New provider validators - cross-cutting', () => {
  it('all 9 new hex validators should accept the same hex signature for same payload and secret', () => {
    const hexSig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateFoodicsSignature(TEST_PAYLOAD, hexSig, TEST_SECRET)).toBe(true)
    expect(validateOracleMicrosSignature(TEST_PAYLOAD, hexSig, TEST_SECRET)).toBe(true)
    expect(validateNcrVoyixSignature(TEST_PAYLOAD, hexSig, TEST_SECRET)).toBe(true)
    expect(validateSpotOnSignature(TEST_PAYLOAD, hexSig, TEST_SECRET)).toBe(true)
    expect(validateRevelSignature(TEST_PAYLOAD, hexSig, TEST_SECRET)).toBe(true)
    expect(validateTouchBistroSignature(TEST_PAYLOAD, hexSig, TEST_SECRET)).toBe(true)
    expect(validateGastrofixSignature(TEST_PAYLOAD, hexSig, TEST_SECRET)).toBe(true)
    expect(validateIikoSignature(TEST_PAYLOAD, hexSig, TEST_SECRET)).toBe(true)
    expect(validatePosRocketSignature(TEST_PAYLOAD, hexSig, TEST_SECRET)).toBe(true)
  })

  it('should handle unicode payloads correctly across all 9 validators', () => {
    const unicodePayload = JSON.stringify({ name: 'Caf\u00e9 \u2014 \u00a312.50 \u0428\u0430\u0432\u0435\u0440\u043c\u0430' })
    const hexSig = hmacHex(unicodePayload, TEST_SECRET)
    expect(validateFoodicsSignature(unicodePayload, hexSig, TEST_SECRET)).toBe(true)
    expect(validateOracleMicrosSignature(unicodePayload, hexSig, TEST_SECRET)).toBe(true)
    expect(validateNcrVoyixSignature(unicodePayload, hexSig, TEST_SECRET)).toBe(true)
    expect(validateSpotOnSignature(unicodePayload, hexSig, TEST_SECRET)).toBe(true)
    expect(validateRevelSignature(unicodePayload, hexSig, TEST_SECRET)).toBe(true)
    expect(validateTouchBistroSignature(unicodePayload, hexSig, TEST_SECRET)).toBe(true)
    expect(validateGastrofixSignature(unicodePayload, hexSig, TEST_SECRET)).toBe(true)
    expect(validateIikoSignature(unicodePayload, hexSig, TEST_SECRET)).toBe(true)
    expect(validatePosRocketSignature(unicodePayload, hexSig, TEST_SECRET)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2: Adapter normalizeEvent Functions
// ═══════════════════════════════════════════════════════════════════════════════

// ── Foodics ──────────────────────────────────────────────────────────────────

describe('foodicsAdapter.normalizeEvent', () => {
  const validPayload = {
    order: {
      reference: 'ORD-123',
      products: [
        { product_id: 'p1', name: 'Shawarma', quantity: 2, price: 15 },
        { product_id: 'p2', name: 'Hummus', quantity: 1, price: 8 },
      ],
      total_price: 38,
      currency: 'SAR',
      created_at: '2026-02-24T12:00:00Z',
    },
  }

  it('should return a valid PosSaleEvent with correct fields', () => {
    const result = foodicsAdapter.normalizeEvent(validPayload)
    expect(result).not.toBeNull()
    expect(result!.external_event_id).toBe('ORD-123')
    expect(result!.event_type).toBe('sale')
    expect(result!.items).toHaveLength(2)
    expect(result!.items[0]).toEqual({
      pos_item_id: 'p1',
      pos_item_name: 'Shawarma',
      quantity: 2,
      unit_price: 15,
    })
    expect(result!.items[1]).toEqual({
      pos_item_id: 'p2',
      pos_item_name: 'Hummus',
      quantity: 1,
      unit_price: 8,
    })
    expect(result!.total_amount).toBe(38)
    expect(result!.currency).toBe('SAR')
    expect(result!.occurred_at).toBe('2026-02-24T12:00:00Z')
  })

  it('should return null when order is missing', () => {
    expect(foodicsAdapter.normalizeEvent({})).toBeNull()
  })

  it('should return null when order has no reference or id', () => {
    expect(foodicsAdapter.normalizeEvent({ order: {} })).toBeNull()
  })

  it('should handle empty products array', () => {
    const result = foodicsAdapter.normalizeEvent({
      order: { reference: 'ORD-EMPTY', products: [], total_price: 0, created_at: '2026-02-24T12:00:00Z' },
    })
    expect(result).not.toBeNull()
    expect(result!.items).toEqual([])
  })

  it('should fall back to order.id if reference is missing', () => {
    const result = foodicsAdapter.normalizeEvent({
      order: { id: 'FALLBACK-ID', products: [], created_at: '2026-02-24T12:00:00Z' },
    })
    expect(result).not.toBeNull()
    expect(result!.external_event_id).toBe('FALLBACK-ID')
  })

  it('should default currency to SAR when not provided', () => {
    const result = foodicsAdapter.normalizeEvent({
      order: { reference: 'ORD-NO-CURRENCY', products: [], created_at: '2026-02-24T12:00:00Z' },
    })
    expect(result!.currency).toBe('SAR')
  })
})

// ── Oracle MICROS ────────────────────────────────────────────────────────────

describe('oracleMicrosAdapter.normalizeEvent', () => {
  const validPayload = {
    checkId: 'CHK-456',
    detailLines: [
      { menuItemId: 'mi1', menuItemName: 'Steak', quantity: 1, price: 2500 },
    ],
    totalDue: 2500,
    currencyCode: 'USD',
    closedTime: '2026-02-24T12:00:00Z',
  }

  it('should return a valid PosSaleEvent with correct fields', () => {
    const result = oracleMicrosAdapter.normalizeEvent(validPayload)
    expect(result).not.toBeNull()
    expect(result!.external_event_id).toBe('CHK-456')
    expect(result!.event_type).toBe('sale')
    expect(result!.items).toHaveLength(1)
    expect(result!.items[0]).toEqual({
      pos_item_id: 'mi1',
      pos_item_name: 'Steak',
      quantity: 1,
      unit_price: 25, // price 2500 / 100
    })
    expect(result!.total_amount).toBe(25) // totalDue 2500 / 100
    expect(result!.currency).toBe('USD')
    expect(result!.occurred_at).toBe('2026-02-24T12:00:00Z')
  })

  it('should return null when checkId and transactionId are missing', () => {
    expect(oracleMicrosAdapter.normalizeEvent({})).toBeNull()
  })

  it('should return null for empty payload', () => {
    expect(oracleMicrosAdapter.normalizeEvent({ detailLines: [] })).toBeNull()
  })

  it('should set event_type to void when isVoid is truthy', () => {
    const result = oracleMicrosAdapter.normalizeEvent({
      checkId: 'CHK-VOID',
      isVoid: true,
      detailLines: [],
      closedTime: '2026-02-24T12:00:00Z',
    })
    expect(result!.event_type).toBe('void')
  })

  it('should fall back to transactionId if checkId is missing', () => {
    const result = oracleMicrosAdapter.normalizeEvent({
      transactionId: 'TXN-789',
      detailLines: [],
      closedTime: '2026-02-24T12:00:00Z',
    })
    expect(result!.external_event_id).toBe('TXN-789')
  })

  it('should default currency to USD when currencyCode is not provided', () => {
    const result = oracleMicrosAdapter.normalizeEvent({
      checkId: 'CHK-NO-CURR',
      detailLines: [],
      closedTime: '2026-02-24T12:00:00Z',
    })
    expect(result!.currency).toBe('USD')
  })
})

// ── NCR Voyix ────────────────────────────────────────────────────────────────

describe('ncrVoyixAdapter.normalizeEvent', () => {
  const validPayload = {
    orderId: 'ORD-789',
    orderLines: [
      { itemId: 'i1', itemName: 'Burger', quantity: 3, price: 12.99 },
    ],
    totalAmount: 38.97,
    closedDateTime: '2026-02-24T12:00:00Z',
  }

  it('should return a valid PosSaleEvent with correct fields', () => {
    const result = ncrVoyixAdapter.normalizeEvent(validPayload)
    expect(result).not.toBeNull()
    expect(result!.external_event_id).toBe('ORD-789')
    expect(result!.event_type).toBe('sale')
    expect(result!.items).toHaveLength(1)
    expect(result!.items[0]).toEqual({
      pos_item_id: 'i1',
      pos_item_name: 'Burger',
      quantity: 3,
      unit_price: 12.99,
    })
    expect(result!.total_amount).toBe(38.97)
    expect(result!.currency).toBe('USD')
    expect(result!.occurred_at).toBe('2026-02-24T12:00:00Z')
  })

  it('should return null when orderId and checkNumber are missing', () => {
    expect(ncrVoyixAdapter.normalizeEvent({})).toBeNull()
  })

  it('should return null for empty payload', () => {
    expect(ncrVoyixAdapter.normalizeEvent({ orderLines: [] })).toBeNull()
  })

  it('should set event_type to void when isVoided is truthy', () => {
    const result = ncrVoyixAdapter.normalizeEvent({
      orderId: 'ORD-VOID',
      isVoided: true,
      orderLines: [],
      closedDateTime: '2026-02-24T12:00:00Z',
    })
    expect(result!.event_type).toBe('void')
  })

  it('should set event_type to refund when isRefund is truthy', () => {
    const result = ncrVoyixAdapter.normalizeEvent({
      orderId: 'ORD-REFUND',
      isRefund: true,
      orderLines: [],
      closedDateTime: '2026-02-24T12:00:00Z',
    })
    expect(result!.event_type).toBe('refund')
  })

  it('should fall back to checkNumber if orderId is missing', () => {
    const result = ncrVoyixAdapter.normalizeEvent({
      checkNumber: 'CHK-FALLBACK',
      orderLines: [],
      closedDateTime: '2026-02-24T12:00:00Z',
    })
    expect(result!.external_event_id).toBe('CHK-FALLBACK')
  })

  it('should default currency to USD', () => {
    const result = ncrVoyixAdapter.normalizeEvent({
      orderId: 'ORD-CURR',
      orderLines: [],
      closedDateTime: '2026-02-24T12:00:00Z',
    })
    expect(result!.currency).toBe('USD')
  })
})

// ── SpotOn ───────────────────────────────────────────────────────────────────

describe('spotOnAdapter.normalizeEvent', () => {
  const validPayload = {
    orderId: 'SO-001',
    lineItems: [
      { itemId: 'it1', name: 'Pizza', quantity: 1, price: 1499 },
    ],
    total: 1499,
    createdAt: '2026-02-24T12:00:00Z',
  }

  it('should return a valid PosSaleEvent with correct fields', () => {
    const result = spotOnAdapter.normalizeEvent(validPayload)
    expect(result).not.toBeNull()
    expect(result!.external_event_id).toBe('SO-001')
    expect(result!.event_type).toBe('sale')
    expect(result!.items).toHaveLength(1)
    expect(result!.items[0]).toEqual({
      pos_item_id: 'it1',
      pos_item_name: 'Pizza',
      quantity: 1,
      unit_price: 14.99, // 1499 / 100
    })
    expect(result!.total_amount).toBe(14.99) // 1499 / 100
    expect(result!.currency).toBe('USD')
    expect(result!.occurred_at).toBe('2026-02-24T12:00:00Z')
  })

  it('should return null when orderId and id are missing', () => {
    expect(spotOnAdapter.normalizeEvent({})).toBeNull()
  })

  it('should return null for empty payload', () => {
    expect(spotOnAdapter.normalizeEvent({ lineItems: [] })).toBeNull()
  })

  it('should set event_type to refund when type is refund', () => {
    const result = spotOnAdapter.normalizeEvent({
      orderId: 'SO-REFUND',
      type: 'refund',
      lineItems: [],
      createdAt: '2026-02-24T12:00:00Z',
    })
    expect(result!.event_type).toBe('refund')
  })

  it('should fall back to id if orderId is missing', () => {
    const result = spotOnAdapter.normalizeEvent({
      id: 'SO-FALLBACK',
      lineItems: [],
      createdAt: '2026-02-24T12:00:00Z',
    })
    expect(result!.external_event_id).toBe('SO-FALLBACK')
  })

  it('should default currency to USD', () => {
    const result = spotOnAdapter.normalizeEvent({
      orderId: 'SO-CURR',
      lineItems: [],
      createdAt: '2026-02-24T12:00:00Z',
    })
    expect(result!.currency).toBe('USD')
  })
})

// ── Revel ────────────────────────────────────────────────────────────────────

describe('revelAdapter.normalizeEvent', () => {
  const validPayload = {
    order_id: 'RV-001',
    items: [
      { product_id: 'rp1', product_name: 'Pasta', quantity: 2, price: 14.50 },
    ],
    final_total: 29.00,
    created_date: '2026-02-24T12:00:00Z',
  }

  it('should return a valid PosSaleEvent with correct fields', () => {
    const result = revelAdapter.normalizeEvent(validPayload)
    expect(result).not.toBeNull()
    expect(result!.external_event_id).toBe('RV-001')
    expect(result!.event_type).toBe('sale')
    expect(result!.items).toHaveLength(1)
    expect(result!.items[0]).toEqual({
      pos_item_id: 'rp1',
      pos_item_name: 'Pasta',
      quantity: 2,
      unit_price: 14.50,
    })
    expect(result!.total_amount).toBe(29.00)
    expect(result!.currency).toBe('USD')
    expect(result!.occurred_at).toBe('2026-02-24T12:00:00Z')
  })

  it('should return null when order_id and id are missing', () => {
    expect(revelAdapter.normalizeEvent({})).toBeNull()
  })

  it('should return null for empty payload', () => {
    expect(revelAdapter.normalizeEvent({ items: [] })).toBeNull()
  })

  it('should set event_type to refund when is_refund is truthy', () => {
    const result = revelAdapter.normalizeEvent({
      order_id: 'RV-REFUND',
      is_refund: true,
      items: [],
      created_date: '2026-02-24T12:00:00Z',
    })
    expect(result!.event_type).toBe('refund')
  })

  it('should fall back to id if order_id is missing', () => {
    const result = revelAdapter.normalizeEvent({
      id: 'RV-FALLBACK',
      items: [],
      created_date: '2026-02-24T12:00:00Z',
    })
    expect(result!.external_event_id).toBe('RV-FALLBACK')
  })

  it('should default currency to USD', () => {
    const result = revelAdapter.normalizeEvent({
      order_id: 'RV-CURR',
      items: [],
      created_date: '2026-02-24T12:00:00Z',
    })
    expect(result!.currency).toBe('USD')
  })
})

// ── TouchBistro ──────────────────────────────────────────────────────────────

describe('touchBistroAdapter.normalizeEvent', () => {
  const validPayload = {
    order_id: 'TB-001',
    order_items: [
      { menu_item_id: 'tb1', menu_item_name: 'Salmon', quantity: 1, price: 22 },
    ],
    total: 22,
    currency: 'CAD',
    closed_at: '2026-02-24T12:00:00Z',
  }

  it('should return a valid PosSaleEvent with correct fields', () => {
    const result = touchBistroAdapter.normalizeEvent(validPayload)
    expect(result).not.toBeNull()
    expect(result!.external_event_id).toBe('TB-001')
    expect(result!.event_type).toBe('sale')
    expect(result!.items).toHaveLength(1)
    expect(result!.items[0]).toEqual({
      pos_item_id: 'tb1',
      pos_item_name: 'Salmon',
      quantity: 1,
      unit_price: 22,
    })
    expect(result!.total_amount).toBe(22)
    expect(result!.currency).toBe('CAD')
    expect(result!.occurred_at).toBe('2026-02-24T12:00:00Z')
  })

  it('should return null when order_id and bill_id are missing', () => {
    expect(touchBistroAdapter.normalizeEvent({})).toBeNull()
  })

  it('should return null for empty payload', () => {
    expect(touchBistroAdapter.normalizeEvent({ order_items: [] })).toBeNull()
  })

  it('should set event_type to refund when is_refund is truthy', () => {
    const result = touchBistroAdapter.normalizeEvent({
      order_id: 'TB-REFUND',
      is_refund: true,
      order_items: [],
      closed_at: '2026-02-24T12:00:00Z',
    })
    expect(result!.event_type).toBe('refund')
  })

  it('should fall back to bill_id if order_id is missing', () => {
    const result = touchBistroAdapter.normalizeEvent({
      bill_id: 'TB-BILL',
      order_items: [],
      closed_at: '2026-02-24T12:00:00Z',
    })
    expect(result!.external_event_id).toBe('TB-BILL')
  })

  it('should default currency to CAD when not provided', () => {
    const result = touchBistroAdapter.normalizeEvent({
      order_id: 'TB-NO-CURR',
      order_items: [],
      closed_at: '2026-02-24T12:00:00Z',
    })
    expect(result!.currency).toBe('CAD')
  })
})

// ── Gastrofix ────────────────────────────────────────────────────────────────

describe('gastrofixAdapter.normalizeEvent', () => {
  const validPayload = {
    receiptId: 'GF-001',
    positions: [
      { articleId: 'a1', articleName: 'Schnitzel', quantity: 2, unitPrice: 1490 },
    ],
    totalAmount: 2980,
    closedAt: '2026-02-24T12:00:00Z',
  }

  it('should return a valid PosSaleEvent with correct fields', () => {
    const result = gastrofixAdapter.normalizeEvent(validPayload)
    expect(result).not.toBeNull()
    expect(result!.external_event_id).toBe('GF-001')
    expect(result!.event_type).toBe('sale')
    expect(result!.items).toHaveLength(1)
    expect(result!.items[0]).toEqual({
      pos_item_id: 'a1',
      pos_item_name: 'Schnitzel',
      quantity: 2,
      unit_price: 14.90, // 1490 / 100
    })
    expect(result!.total_amount).toBe(29.80) // 2980 / 100
    expect(result!.currency).toBe('EUR')
    expect(result!.occurred_at).toBe('2026-02-24T12:00:00Z')
  })

  it('should return null when receiptId and bon_id are missing', () => {
    expect(gastrofixAdapter.normalizeEvent({})).toBeNull()
  })

  it('should return null for empty payload', () => {
    expect(gastrofixAdapter.normalizeEvent({ positions: [] })).toBeNull()
  })

  it('should set event_type to void when storno is truthy', () => {
    const result = gastrofixAdapter.normalizeEvent({
      receiptId: 'GF-STORNO',
      storno: true,
      positions: [],
      closedAt: '2026-02-24T12:00:00Z',
    })
    expect(result!.event_type).toBe('void')
  })

  it('should fall back to bon_id if receiptId is missing', () => {
    const result = gastrofixAdapter.normalizeEvent({
      bon_id: 'GF-BON',
      positions: [],
      closedAt: '2026-02-24T12:00:00Z',
    })
    expect(result!.external_event_id).toBe('GF-BON')
  })

  it('should default currency to EUR', () => {
    const result = gastrofixAdapter.normalizeEvent({
      receiptId: 'GF-EUR',
      positions: [],
      closedAt: '2026-02-24T12:00:00Z',
    })
    expect(result!.currency).toBe('EUR')
  })

  it('should support German-language alternative field names', () => {
    const result = gastrofixAdapter.normalizeEvent({
      bon_id: 'GF-DE',
      positions: [
        { artikel_id: 'de1', bezeichnung: 'Bratwurst', anzahl: 3, einzelpreis: 850 },
      ],
      gesamtbetrag: 2550,
      datum: '2026-02-24T18:00:00Z',
    })
    expect(result).not.toBeNull()
    expect(result!.external_event_id).toBe('GF-DE')
    expect(result!.items[0].pos_item_id).toBe('de1')
    expect(result!.items[0].pos_item_name).toBe('Bratwurst')
    expect(result!.items[0].quantity).toBe(3)
    expect(result!.items[0].unit_price).toBe(8.50) // 850 / 100
    expect(result!.total_amount).toBe(25.50) // 2550 / 100
    expect(result!.occurred_at).toBe('2026-02-24T18:00:00Z')
  })
})

// ── iiko ─────────────────────────────────────────────────────────────────────

describe('iikoAdapter.normalizeEvent', () => {
  const validPayload = {
    orderId: 'IK-001',
    items: [
      { productId: 'ip1', productName: 'Pelmeni', amount: 3, price: 450 },
    ],
    sum: 1350,
    currency: 'RUB',
    whenClosed: '2026-02-24T12:00:00Z',
  }

  it('should return a valid PosSaleEvent with correct fields', () => {
    const result = iikoAdapter.normalizeEvent(validPayload)
    expect(result).not.toBeNull()
    expect(result!.external_event_id).toBe('IK-001')
    expect(result!.event_type).toBe('sale')
    expect(result!.items).toHaveLength(1)
    expect(result!.items[0]).toEqual({
      pos_item_id: 'ip1',
      pos_item_name: 'Pelmeni',
      quantity: 3,
      unit_price: 450,
    })
    expect(result!.total_amount).toBe(1350)
    expect(result!.currency).toBe('RUB')
    expect(result!.occurred_at).toBe('2026-02-24T12:00:00Z')
  })

  it('should return null when orderId and order_id are missing', () => {
    expect(iikoAdapter.normalizeEvent({})).toBeNull()
  })

  it('should return null for empty payload', () => {
    expect(iikoAdapter.normalizeEvent({ items: [] })).toBeNull()
  })

  it('should set event_type to void when isStorned is truthy', () => {
    const result = iikoAdapter.normalizeEvent({
      orderId: 'IK-STORNO',
      isStorned: true,
      items: [],
      whenClosed: '2026-02-24T12:00:00Z',
    })
    expect(result!.event_type).toBe('void')
  })

  it('should fall back to order_id if orderId is missing', () => {
    const result = iikoAdapter.normalizeEvent({
      order_id: 'IK-FALLBACK',
      items: [],
      whenClosed: '2026-02-24T12:00:00Z',
    })
    expect(result!.external_event_id).toBe('IK-FALLBACK')
  })

  it('should default currency to RUB when not provided', () => {
    const result = iikoAdapter.normalizeEvent({
      orderId: 'IK-NO-CURR',
      items: [],
      whenClosed: '2026-02-24T12:00:00Z',
    })
    expect(result!.currency).toBe('RUB')
  })

  it('should use amount field for quantity', () => {
    const result = iikoAdapter.normalizeEvent({
      orderId: 'IK-AMT',
      items: [{ productId: 'x', productName: 'Borscht', amount: 5, price: 200 }],
      whenClosed: '2026-02-24T12:00:00Z',
    })
    expect(result!.items[0].quantity).toBe(5)
  })
})

// ── POSRocket ────────────────────────────────────────────────────────────────

describe('posRocketAdapter.normalizeEvent', () => {
  const validPayload = {
    order_id: 'PR-001',
    line_items: [
      { item_id: 'pr1', item_name: 'Kebab', quantity: 2, price: 35 },
    ],
    total: 70,
    currency: 'SAR',
    created_at: '2026-02-24T12:00:00Z',
  }

  it('should return a valid PosSaleEvent with correct fields', () => {
    const result = posRocketAdapter.normalizeEvent(validPayload)
    expect(result).not.toBeNull()
    expect(result!.external_event_id).toBe('PR-001')
    expect(result!.event_type).toBe('sale')
    expect(result!.items).toHaveLength(1)
    expect(result!.items[0]).toEqual({
      pos_item_id: 'pr1',
      pos_item_name: 'Kebab',
      quantity: 2,
      unit_price: 35,
    })
    expect(result!.total_amount).toBe(70)
    expect(result!.currency).toBe('SAR')
    expect(result!.occurred_at).toBe('2026-02-24T12:00:00Z')
  })

  it('should return null when order_id and receipt_number are missing', () => {
    expect(posRocketAdapter.normalizeEvent({})).toBeNull()
  })

  it('should return null for empty payload', () => {
    expect(posRocketAdapter.normalizeEvent({ line_items: [] })).toBeNull()
  })

  it('should set event_type to refund when type is refund', () => {
    const result = posRocketAdapter.normalizeEvent({
      order_id: 'PR-REFUND',
      type: 'refund',
      line_items: [],
      created_at: '2026-02-24T12:00:00Z',
    })
    expect(result!.event_type).toBe('refund')
  })

  it('should fall back to receipt_number if order_id is missing', () => {
    const result = posRocketAdapter.normalizeEvent({
      receipt_number: 'PR-RECEIPT',
      line_items: [],
      created_at: '2026-02-24T12:00:00Z',
    })
    expect(result!.external_event_id).toBe('PR-RECEIPT')
  })

  it('should default currency to SAR when not provided', () => {
    const result = posRocketAdapter.normalizeEvent({
      order_id: 'PR-NO-CURR',
      line_items: [],
      created_at: '2026-02-24T12:00:00Z',
    })
    expect(result!.currency).toBe('SAR')
  })

  it('should handle multiple line items correctly', () => {
    const result = posRocketAdapter.normalizeEvent({
      order_id: 'PR-MULTI',
      line_items: [
        { item_id: 'pr1', item_name: 'Kebab', quantity: 2, price: 35 },
        { item_id: 'pr2', item_name: 'Falafel', quantity: 4, price: 12 },
        { item_id: 'pr3', item_name: 'Manakeesh', quantity: 1, price: 18 },
      ],
      total: 136,
      currency: 'SAR',
      created_at: '2026-02-24T12:00:00Z',
    })
    expect(result).not.toBeNull()
    expect(result!.items).toHaveLength(3)
    expect(result!.items[0].pos_item_name).toBe('Kebab')
    expect(result!.items[1].pos_item_name).toBe('Falafel')
    expect(result!.items[2].pos_item_name).toBe('Manakeesh')
    expect(result!.total_amount).toBe(136)
  })
})
