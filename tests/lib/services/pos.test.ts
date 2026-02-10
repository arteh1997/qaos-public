import { describe, it, expect, vi, beforeEach } from 'vitest'

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
    } else if (method === 'insert') {
      mock[method] = vi.fn(() => mock)
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

describe('POS Service', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  describe('processSaleEvent', () => {
    const baseEvent = {
      external_event_id: 'pos-evt-001',
      event_type: 'sale' as const,
      items: [
        { pos_item_id: 'burger-1', pos_item_name: 'Classic Burger', quantity: 2, unit_price: 12.99 },
      ],
      total_amount: 25.98,
      currency: 'USD',
      occurred_at: '2026-02-10T14:30:00Z',
    }

    it('should skip duplicate events', async () => {
      // pos_sale_events select -> return existing event (duplicate found)
      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'pos_sale_events') {
          return createChainableMock({
            data: { id: 'existing-event-1', status: 'processed' },
            error: null,
          })
        }
        return createChainableMock({ data: null, error: null })
      })

      const { processSaleEvent } = await import('@/lib/services/pos')
      const result = await processSaleEvent('conn-1', 'store-123', baseEvent)

      expect(result.status).toBe('skipped')
      expect(result.event_id).toBe('existing-event-1')
      expect(result.items_deducted).toBe(0)
      expect(result.error).toBe('Duplicate event')
    })

    it('should record event and deduct inventory', async () => {
      let saleEventSelectCalled = false

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'pos_sale_events') {
          if (!saleEventSelectCalled) {
            // First call: duplicate check -> no duplicate found (maybeSingle returns null)
            saleEventSelectCalled = true
            return createChainableMock({ data: null, error: null })
          }
          // Subsequent calls: insert (returns { id }), or update (status update)
          const mock = createChainableMock({ data: { id: 'event-1' }, error: null })
          mock.update = vi.fn(() => createChainableMock({ data: null, error: null }))
          return mock
        }

        if (table === 'pos_item_mappings') {
          // Return a mapping for burger-1
          return createChainableMock({
            data: [
              {
                pos_item_id: 'burger-1',
                inventory_item_id: 'inv-item-1',
                quantity_per_sale: 1,
              },
            ],
            error: null,
          })
        }

        if (table === 'store_inventory') {
          const mock = createChainableMock({
            data: { quantity: 50 },
            error: null,
          })
          mock.upsert = vi.fn().mockResolvedValue({ error: null })
          return mock
        }

        if (table === 'stock_history') {
          const mock = createChainableMock({ data: null, error: null })
          mock.insert = vi.fn().mockResolvedValue({ data: null, error: null })
          return mock
        }

        if (table === 'pos_connections') {
          const mock = createChainableMock({ data: null, error: null })
          mock.update = vi.fn(() => createChainableMock({ data: null, error: null }))
          return mock
        }

        return createChainableMock({ data: null, error: null })
      })

      const { processSaleEvent } = await import('@/lib/services/pos')
      const result = await processSaleEvent('conn-1', 'store-123', baseEvent)

      expect(result.status).toBe('processed')
      expect(result.event_id).toBe('event-1')
      expect(result.items_deducted).toBe(1)
      expect(result.items_skipped).toBe(0)
    })

    it('should handle unmapped items', async () => {
      let saleEventSelectCalled = false

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'pos_sale_events') {
          if (!saleEventSelectCalled) {
            // Duplicate check -> no duplicate
            saleEventSelectCalled = true
            return createChainableMock({ data: null, error: null })
          }
          // Insert or update
          const mock = createChainableMock({ data: { id: 'event-2' }, error: null })
          mock.update = vi.fn(() => createChainableMock({ data: null, error: null }))
          return mock
        }

        if (table === 'pos_item_mappings') {
          // Return no mappings -> all items should be skipped
          return createChainableMock({ data: [], error: null })
        }

        if (table === 'pos_connections') {
          const mock = createChainableMock({ data: null, error: null })
          mock.update = vi.fn(() => createChainableMock({ data: null, error: null }))
          return mock
        }

        return createChainableMock({ data: null, error: null })
      })

      const { processSaleEvent } = await import('@/lib/services/pos')
      const result = await processSaleEvent('conn-1', 'store-123', baseEvent)

      // All items skipped, none deducted -> status should be 'failed'
      expect(result.status).toBe('failed')
      expect(result.items_deducted).toBe(0)
      expect(result.items_skipped).toBe(1)
    })

    it('should handle refund events (adds back inventory)', async () => {
      let saleEventSelectCalled = false

      const refundEvent = {
        ...baseEvent,
        external_event_id: 'pos-refund-001',
        event_type: 'refund' as const,
        items: [
          { pos_item_id: 'burger-1', pos_item_name: 'Classic Burger', quantity: 1, unit_price: 12.99 },
        ],
      }

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'pos_sale_events') {
          if (!saleEventSelectCalled) {
            // Duplicate check -> no duplicate
            saleEventSelectCalled = true
            return createChainableMock({ data: null, error: null })
          }
          // Insert or update
          const mock = createChainableMock({ data: { id: 'refund-event-1' }, error: null })
          mock.update = vi.fn(() => createChainableMock({ data: null, error: null }))
          return mock
        }

        if (table === 'pos_item_mappings') {
          return createChainableMock({
            data: [
              {
                pos_item_id: 'burger-1',
                inventory_item_id: 'inv-item-1',
                quantity_per_sale: 1,
              },
            ],
            error: null,
          })
        }

        if (table === 'store_inventory') {
          const mock = createChainableMock({
            data: { quantity: 48 },
            error: null,
          })
          mock.upsert = vi.fn().mockResolvedValue({ error: null })
          return mock
        }

        if (table === 'stock_history') {
          const mock = createChainableMock({ data: null, error: null })
          mock.insert = vi.fn().mockResolvedValue({ data: null, error: null })
          return mock
        }

        if (table === 'pos_connections') {
          const mock = createChainableMock({ data: null, error: null })
          mock.update = vi.fn(() => createChainableMock({ data: null, error: null }))
          return mock
        }

        return createChainableMock({ data: null, error: null })
      })

      const { processSaleEvent } = await import('@/lib/services/pos')
      const result = await processSaleEvent('conn-1', 'store-123', refundEvent)

      expect(result.status).toBe('processed')
      expect(result.event_id).toBe('refund-event-1')
      expect(result.items_deducted).toBe(1)
      expect(result.items_skipped).toBe(0)
    })
  })

  describe('validateWebhookSignature', () => {
    it('should return true for all supported providers', async () => {
      const { validateWebhookSignature } = await import('@/lib/services/pos')

      const providers = ['square', 'toast', 'clover', 'lightspeed', 'custom'] as const

      for (const provider of providers) {
        const result = validateWebhookSignature(provider, 'payload', 'sig', 'secret')
        expect(result).toBe(true)
      }
    })
  })
})
