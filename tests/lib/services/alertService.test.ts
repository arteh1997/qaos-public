import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock email sending
const mockSendEmail = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/email', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}))

// Mock email templates
vi.mock('@/lib/email-alerts', () => ({
  getLowStockAlertEmailHtml: vi.fn(() => '<html>low stock</html>'),
  getCriticalStockAlertEmailHtml: vi.fn(() => '<html>critical stock</html>'),
  getMissingCountAlertEmailHtml: vi.fn(() => '<html>missing count</html>'),
}))

// Mock supabase admin client
const mockFrom = vi.fn()
const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null })
const mockSelect = vi.fn()

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
      mock[method] = vi.fn().mockResolvedValue(resolvedValue)
    } else {
      mock[method] = vi.fn(() => mock)
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mock.then = ((resolve?: any) => Promise.resolve(resolvedValue).then(resolve)) as any
  return mock
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}))

describe('Alert Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendEmail.mockResolvedValue({ success: true })
  })

  describe('processScheduledAlerts', () => {
    it('should handle no preferences for the current hour', async () => {
      // Return empty preferences
      mockFrom.mockReturnValue(createChainableMock({ data: [], error: null }))

      const { processScheduledAlerts } = await import('@/lib/services/alertService')
      const results = await processScheduledAlerts(8)

      expect(results).toEqual([])
    })

    it('should handle preferences fetch error gracefully', async () => {
      mockFrom.mockReturnValue(createChainableMock({ data: null, error: { message: 'DB error' } }))

      const { processScheduledAlerts } = await import('@/lib/services/alertService')
      const results = await processScheduledAlerts(8)

      expect(results).toEqual([])
    })

    it('should skip inactive stores', async () => {
      const prefsQuery = createChainableMock({
        data: [{
          store_id: 'store-1',
          user_id: 'user-1',
          low_stock_enabled: true,
          critical_stock_enabled: true,
          missing_count_enabled: true,
          low_stock_threshold: 1.0,
          alert_frequency: 'daily',
          email_enabled: true,
          preferred_hour: 8,
          store: { id: 'store-1', name: 'Inactive Store', is_active: false },
          user: { id: 'user-1', email: 'test@example.com', full_name: 'Test' },
        }],
        error: null,
      })

      mockFrom.mockReturnValue(prefsQuery)

      const { processScheduledAlerts } = await import('@/lib/services/alertService')
      const results = await processScheduledAlerts(8)

      expect(results).toEqual([])
      expect(mockSendEmail).not.toHaveBeenCalled()
    })

    it('should send low stock alert when items are below par', async () => {
      const prefsData = [{
        store_id: 'store-1',
        user_id: 'user-1',
        low_stock_enabled: true,
        critical_stock_enabled: true,
        missing_count_enabled: false,
        low_stock_threshold: 1.0,
        alert_frequency: 'daily',
        email_enabled: true,
        preferred_hour: 8,
        store: { id: 'store-1', name: 'Test Store', is_active: true },
        user: { id: 'user-1', email: 'owner@test.com', full_name: 'Owner' },
      }]

      const inventoryData = [
        { quantity: 3, par_level: 10, inventory_item: { name: 'Tomatoes', category: 'Produce', unit_of_measure: 'kg', is_active: true } },
        { quantity: 0, par_level: 5, inventory_item: { name: 'Milk', category: 'Dairy', unit_of_measure: 'L', is_active: true } },
        { quantity: 20, par_level: 10, inventory_item: { name: 'Rice', category: 'Dry Goods', unit_of_measure: 'kg', is_active: true } },
      ]

      let callCount = 0
      mockFrom.mockImplementation((table: string) => {
        if (table === 'alert_preferences') {
          return createChainableMock({ data: prefsData, error: null })
        }
        if (table === 'alert_history') {
          callCount++
          if (callCount <= 1) {
            // First call: check for existing alert
            return createChainableMock({ data: [], error: null })
          }
          // Subsequent calls: recording alerts
          return createChainableMock({ data: null, error: null })
        }
        if (table === 'store_inventory') {
          return createChainableMock({ data: inventoryData, error: null })
        }
        return createChainableMock({ data: [], error: null })
      })

      const { processScheduledAlerts } = await import('@/lib/services/alertService')
      const results = await processScheduledAlerts(8)

      // Should have sent critical (Milk at 0) and low stock (Tomatoes at 3/10) alerts
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(mockSendEmail).toHaveBeenCalled()

      // Check that emails were sent
      const emailCalls = mockSendEmail.mock.calls
      expect(emailCalls.length).toBeGreaterThanOrEqual(1)
      expect(emailCalls[0][0].to).toBe('owner@test.com')
    })

    it('should skip already-sent alerts for the day', async () => {
      const prefsData = [{
        store_id: 'store-1',
        user_id: 'user-1',
        low_stock_enabled: true,
        critical_stock_enabled: true,
        missing_count_enabled: false,
        low_stock_threshold: 1.0,
        alert_frequency: 'daily',
        email_enabled: true,
        preferred_hour: 8,
        store: { id: 'store-1', name: 'Test Store', is_active: true },
        user: { id: 'user-1', email: 'owner@test.com', full_name: 'Owner' },
      }]

      mockFrom.mockImplementation((table: string) => {
        if (table === 'alert_preferences') {
          return createChainableMock({ data: prefsData, error: null })
        }
        if (table === 'alert_history') {
          // Return existing alert for today
          return createChainableMock({ data: [{ id: 'existing-alert' }], error: null })
        }
        return createChainableMock({ data: [], error: null })
      })

      const { processScheduledAlerts } = await import('@/lib/services/alertService')
      const results = await processScheduledAlerts(8)

      expect(results).toEqual([])
      expect(mockSendEmail).not.toHaveBeenCalled()
    })
  })
})
