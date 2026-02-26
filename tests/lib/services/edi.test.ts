import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'

// Create chainable query builder mock that is also thenable (like Supabase queries)
function createChainableMock(resolvedValue: unknown = { data: null, error: null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: Record<string, ReturnType<typeof vi.fn>> & { then?: any } = {}
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'in', 'is', 'or', 'and', 'not', 'filter', 'match',
    'order', 'limit', 'range', 'single', 'maybeSingle',
  ]

  methods.forEach(method => {
    if (method === 'single' || method === 'maybeSingle') {
      mock[method] = vi.fn().mockResolvedValue(resolvedValue)
    } else {
      mock[method] = vi.fn(() => mock)
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mock.then = ((resolve?: any) => Promise.resolve(resolvedValue).then(resolve)) as any
  return mock
}

// Mock admin client
const mockAdminFrom = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
  })),
}))

// Mock audit log
const mockAuditLog = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/audit', () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
  computeFieldChanges: vi.fn().mockReturnValue([]),
}))

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Sample test data
const TEST_STORE_ID = 'store-001'
const TEST_PO_ID = 'po-001'
const TEST_SUPPLIER_ID = 'supplier-001'
const TEST_WEBHOOK_URL = 'https://supplier.example.com/edi/webhook'
const TEST_WEBHOOK_SECRET = 'edi_secret_abc123'

const basePo = {
  id: TEST_PO_ID,
  store_id: TEST_STORE_ID,
  supplier_id: TEST_SUPPLIER_ID,
  po_number: 'PO-2026-0042',
  status: 'submitted',
  expected_delivery_date: '2026-02-28',
  total_amount: 299.50,
  currency: 'GBP',
  notes: 'Please deliver before noon',
  created_by: 'user-001',
  purchase_order_items: [
    {
      id: 'poi-001',
      inventory_item_id: 'item-001',
      quantity_ordered: 50,
      unit_price: 5.99,
    },
  ],
}

const baseSupplier = {
  id: TEST_SUPPLIER_ID,
  name: 'Fresh Foods Ltd',
  edi_enabled: true,
  edi_webhook_url: TEST_WEBHOOK_URL,
  edi_webhook_secret: TEST_WEBHOOK_SECRET,
}

const baseStore = {
  name: 'Downtown Kitchen',
}

const baseInventoryItems = [
  { id: 'item-001', name: 'Chicken Breast', unit_of_measure: 'kg' },
]

const baseSupplierItems = [
  { inventory_item_id: 'item-001', supplier_sku: 'CHK-001' },
]

describe('EDI Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    mockAuditLog.mockClear()
  })

  describe('generateEdiSignature', () => {
    it('should produce correct HMAC-SHA256 hex digest', async () => {
      const { generateEdiSignature } = await import('@/lib/services/edi')

      const payload = '{"event":"purchase_order.submitted"}'
      const secret = 'test-secret-key'

      const result = generateEdiSignature(payload, secret)

      // Verify against Node.js crypto directly
      const expected = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex')

      expect(result).toBe(expected)
      expect(result).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hex is 64 chars
    })

    it('should produce different signatures for different payloads', async () => {
      const { generateEdiSignature } = await import('@/lib/services/edi')

      const secret = 'test-secret'
      const sig1 = generateEdiSignature('payload-1', secret)
      const sig2 = generateEdiSignature('payload-2', secret)

      expect(sig1).not.toBe(sig2)
    })

    it('should produce different signatures for different secrets', async () => {
      const { generateEdiSignature } = await import('@/lib/services/edi')

      const payload = 'same-payload'
      const sig1 = generateEdiSignature(payload, 'secret-1')
      const sig2 = generateEdiSignature(payload, 'secret-2')

      expect(sig1).not.toBe(sig2)
    })
  })

  describe('verifyEdiSignature', () => {
    it('should return true for a valid signature', async () => {
      const { generateEdiSignature, verifyEdiSignature } = await import('@/lib/services/edi')

      const payload = '{"test":"data"}'
      const secret = 'my-secret'
      const signature = generateEdiSignature(payload, secret)

      expect(verifyEdiSignature(payload, signature, secret)).toBe(true)
    })

    it('should return false for an invalid signature', async () => {
      const { verifyEdiSignature } = await import('@/lib/services/edi')

      const payload = '{"test":"data"}'
      const secret = 'my-secret'
      const wrongSignature = 'a'.repeat(64) // wrong but valid hex length

      expect(verifyEdiSignature(payload, wrongSignature, secret)).toBe(false)
    })

    it('should return false for a tampered payload', async () => {
      const { generateEdiSignature, verifyEdiSignature } = await import('@/lib/services/edi')

      const secret = 'my-secret'
      const signature = generateEdiSignature('original-payload', secret)

      expect(verifyEdiSignature('tampered-payload', signature, secret)).toBe(false)
    })

    it('should return false for signature with wrong length', async () => {
      const { verifyEdiSignature } = await import('@/lib/services/edi')

      expect(verifyEdiSignature('payload', 'short', 'secret')).toBe(false)
    })

    it('should return false for non-hex signature of correct length', async () => {
      const { verifyEdiSignature } = await import('@/lib/services/edi')

      // 64-char string but not valid hex
      const badSig = 'z'.repeat(64)
      expect(verifyEdiSignature('payload', badSig, 'secret')).toBe(false)
    })
  })

  describe('sendPurchaseOrderToSupplier', () => {
    function setupMocks(overrides: {
      po?: unknown
      poError?: unknown
      supplier?: unknown
      supplierError?: unknown
      store?: unknown
      inventoryItems?: unknown
      supplierItems?: unknown
    } = {}) {
      const {
        po = basePo,
        poError = null,
        supplier = baseSupplier,
        supplierError = null,
        store = baseStore,
        inventoryItems = baseInventoryItems,
        supplierItems = baseSupplierItems,
      } = overrides

      mockAdminFrom.mockImplementation((table: string) => {
        switch (table) {
          case 'purchase_orders':
            return createChainableMock({ data: po, error: poError })
          case 'suppliers':
            return createChainableMock({ data: supplier, error: supplierError })
          case 'stores':
            return createChainableMock({ data: store, error: null })
          case 'inventory_items':
            return createChainableMock({ data: inventoryItems, error: null })
          case 'supplier_items':
            return createChainableMock({ data: supplierItems, error: null })
          default:
            return createChainableMock({ data: null, error: null })
        }
      })
    }

    it('should return error when PO is not found', async () => {
      setupMocks({ po: null, poError: { message: 'Not found' } })

      const { sendPurchaseOrderToSupplier } = await import('@/lib/services/edi')
      const result = await sendPurchaseOrderToSupplier(TEST_STORE_ID, TEST_PO_ID)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Not found')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should return error when supplier is not found', async () => {
      setupMocks({ supplier: null, supplierError: { message: 'Supplier not found' } })

      const { sendPurchaseOrderToSupplier } = await import('@/lib/services/edi')
      const result = await sendPurchaseOrderToSupplier(TEST_STORE_ID, TEST_PO_ID)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Supplier not found')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should return silently when supplier has edi_enabled: false', async () => {
      setupMocks({
        supplier: { ...baseSupplier, edi_enabled: false },
      })

      const { sendPurchaseOrderToSupplier } = await import('@/lib/services/edi')
      const result = await sendPurchaseOrderToSupplier(TEST_STORE_ID, TEST_PO_ID)

      expect(result.success).toBe(true)
      expect(result.statusCode).toBeUndefined()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should return silently when supplier has no edi_webhook_url', async () => {
      setupMocks({
        supplier: { ...baseSupplier, edi_webhook_url: null },
      })

      const { sendPurchaseOrderToSupplier } = await import('@/lib/services/edi')
      const result = await sendPurchaseOrderToSupplier(TEST_STORE_ID, TEST_PO_ID)

      expect(result.success).toBe(true)
      expect(result.statusCode).toBeUndefined()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should return silently when supplier has empty edi_webhook_url', async () => {
      setupMocks({
        supplier: { ...baseSupplier, edi_webhook_url: '' },
      })

      const { sendPurchaseOrderToSupplier } = await import('@/lib/services/edi')
      const result = await sendPurchaseOrderToSupplier(TEST_STORE_ID, TEST_PO_ID)

      expect(result.success).toBe(true)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should send POST request when EDI is enabled with correct headers', async () => {
      setupMocks()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      })

      const { sendPurchaseOrderToSupplier } = await import('@/lib/services/edi')
      const result = await sendPurchaseOrderToSupplier(TEST_STORE_ID, TEST_PO_ID)

      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(200)
      expect(mockFetch).toHaveBeenCalledOnce()

      // Verify the fetch call
      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe(TEST_WEBHOOK_URL)
      expect(options.method).toBe('POST')
      expect(options.headers['Content-Type']).toBe('application/json')
      expect(options.headers['User-Agent']).toBe('RestaurantInventory/1.0')
      expect(options.headers['X-EDI-Signature']).toMatch(/^[a-f0-9]{64}$/)
      expect(options.headers['X-EDI-Timestamp']).toBeDefined()
    })

    it('should send correct payload structure', async () => {
      setupMocks()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      })

      const { sendPurchaseOrderToSupplier } = await import('@/lib/services/edi')
      await sendPurchaseOrderToSupplier(TEST_STORE_ID, TEST_PO_ID)

      const [, options] = mockFetch.mock.calls[0]
      const body = JSON.parse(options.body)

      expect(body.event).toBe('purchase_order.submitted')
      expect(body.timestamp).toBeDefined()
      expect(body.purchase_order.po_number).toBe('PO-2026-0042')
      expect(body.purchase_order.store_name).toBe('Downtown Kitchen')
      expect(body.purchase_order.status).toBe('submitted')
      expect(body.purchase_order.expected_delivery_date).toBe('2026-02-28')
      expect(body.purchase_order.total).toBe(299.50)
      expect(body.purchase_order.currency).toBe('GBP')
      expect(body.purchase_order.notes).toBe('Please deliver before noon')
      expect(body.purchase_order.items).toHaveLength(1)
      expect(body.purchase_order.items[0]).toEqual({
        name: 'Chicken Breast',
        sku: 'CHK-001',
        quantity: 50,
        unit: 'kg',
        unit_price: 5.99,
      })
    })

    it('should sign the payload with the supplier webhook secret', async () => {
      setupMocks()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      })

      const { sendPurchaseOrderToSupplier, generateEdiSignature } = await import('@/lib/services/edi')
      await sendPurchaseOrderToSupplier(TEST_STORE_ID, TEST_PO_ID)

      const [, options] = mockFetch.mock.calls[0]
      const sentSignature = options.headers['X-EDI-Signature']
      const sentBody = options.body

      // Re-compute expected signature
      const expectedSignature = generateEdiSignature(sentBody, TEST_WEBHOOK_SECRET)
      expect(sentSignature).toBe(expectedSignature)
    })

    it('should return failure when supplier webhook returns non-OK status', async () => {
      setupMocks()

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      })

      const { sendPurchaseOrderToSupplier } = await import('@/lib/services/edi')
      const result = await sendPurchaseOrderToSupplier(TEST_STORE_ID, TEST_PO_ID)

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(500)
      expect(result.error).toContain('500')
    })

    it('should return failure when fetch throws a network error', async () => {
      setupMocks()

      mockFetch.mockRejectedValueOnce(new Error('Network error: ECONNREFUSED'))

      const { sendPurchaseOrderToSupplier } = await import('@/lib/services/edi')
      const result = await sendPurchaseOrderToSupplier(TEST_STORE_ID, TEST_PO_ID)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error: ECONNREFUSED')
      expect(result.statusCode).toBeUndefined()
    })

    it('should log successful delivery via auditLog', async () => {
      setupMocks()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      })

      const { sendPurchaseOrderToSupplier } = await import('@/lib/services/edi')
      await sendPurchaseOrderToSupplier(TEST_STORE_ID, TEST_PO_ID)

      expect(mockAuditLog).toHaveBeenCalledOnce()
      const [, auditEntry] = mockAuditLog.mock.calls[0]
      expect(auditEntry.action).toBe('supplier.edi_po_delivered')
      expect(auditEntry.storeId).toBe(TEST_STORE_ID)
      expect(auditEntry.resourceType).toBe('purchase_order')
      expect(auditEntry.resourceId).toBe(TEST_PO_ID)
      expect(auditEntry.details.success).toBe(true)
      expect(auditEntry.details.status_code).toBe(200)
    })

    it('should log failed delivery via auditLog', async () => {
      setupMocks()

      mockFetch.mockRejectedValueOnce(new Error('Connection refused'))

      const { sendPurchaseOrderToSupplier } = await import('@/lib/services/edi')
      await sendPurchaseOrderToSupplier(TEST_STORE_ID, TEST_PO_ID)

      expect(mockAuditLog).toHaveBeenCalledOnce()
      const [, auditEntry] = mockAuditLog.mock.calls[0]
      expect(auditEntry.action).toBe('supplier.edi_po_delivery_failed')
      expect(auditEntry.details.error).toBe('Connection refused')
    })
  })
})
