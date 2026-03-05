import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create chainable query builder mock that is also thenable (like Supabase queries)
function createChainableMock(resolvedValue: unknown = { data: null, error: null }) {
   
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

// Mock email sending
const mockSendEmail = vi.fn().mockResolvedValue({ success: true })

vi.mock('@/lib/email', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
  getSupplierPortalInviteEmailHtml: vi.fn().mockReturnValue('<html>supplier portal invite</html>'),
}))

// Mock email notification templates
vi.mock('@/lib/email-notifications', () => ({
  getShiftAssignedEmailHtml: vi.fn().mockReturnValue('<html>shift assigned</html>'),
  getShiftUpdatedEmailHtml: vi.fn().mockReturnValue('<html>shift updated</html>'),
  getShiftCancelledEmailHtml: vi.fn().mockReturnValue('<html>shift cancelled</html>'),
  getPayslipAvailableEmailHtml: vi.fn().mockReturnValue('<html>payslip available</html>'),
  getPOStatusUpdateEmailHtml: vi.fn().mockReturnValue('<html>po status update</html>'),
  getDeliveryReceivedEmailHtml: vi.fn().mockReturnValue('<html>delivery received</html>'),
  getRemovedFromStoreEmailHtml: vi.fn().mockReturnValue('<html>removed from store</html>'),
  getPaymentSucceededEmailHtml: vi.fn().mockReturnValue('<html>payment succeeded</html>'),
  getSubscriptionCancelledEmailHtml: vi.fn().mockReturnValue('<html>subscription cancelled</html>'),
}))

describe('Notification Service', () => {
  const storeId = 'store-111'
  const recipientUserId = 'user-222'
  const triggeredByUserId = 'user-333'

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockSendEmail.mockResolvedValue({ success: true })
  })

  describe('sendNotification', () => {
    const shiftData = {
      storeName: 'Pizza Palace',
      managerName: 'Alice',
      date: '2026-02-25',
      dayOfWeek: 'Wednesday',
      startTime: '09:00',
      endTime: '17:00',
      duration: '8h',
      notes: null,
    }

    it('should send email when preferences allow', async () => {
      // notification_preferences -> preference exists with shift_assigned = true
      // profiles -> return recipient profile
      // alert_history -> insert success
      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'notification_preferences') {
          return createChainableMock({
            data: { shift_assigned: true },
            error: null,
          })
        }
        if (table === 'profiles') {
          return createChainableMock({
            data: { email: 'recipient@test.com', full_name: 'Bob' },
            error: null,
          })
        }
        if (table === 'alert_history') {
          const mock = createChainableMock({ data: null, error: null })
          mock.insert = vi.fn().mockResolvedValue({ data: null, error: null })
          return mock
        }
        return createChainableMock({ data: null, error: null })
      })

      const { sendNotification } = await import('@/lib/services/notifications')
      await sendNotification({
        type: 'shift_assigned',
        storeId,
        recipientUserId,
        data: shiftData,
        triggeredByUserId,
      })

      // Email should be sent to the recipient
      expect(mockSendEmail).toHaveBeenCalledTimes(1)
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@test.com',
          subject: expect.stringContaining('New Shift'),
          html: '<html>shift assigned</html>',
        })
      )

      // Alert history should be logged
      expect(mockAdminFrom).toHaveBeenCalledWith('alert_history')
    })

    it('should skip when preference is disabled', async () => {
      // notification_preferences -> preference exists with shift_assigned = false
      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'notification_preferences') {
          return createChainableMock({
            data: { shift_assigned: false },
            error: null,
          })
        }
        return createChainableMock({ data: null, error: null })
      })

      const { sendNotification } = await import('@/lib/services/notifications')
      await sendNotification({
        type: 'shift_assigned',
        storeId,
        recipientUserId,
        data: shiftData,
        triggeredByUserId,
      })

      // Email should NOT be sent
      expect(mockSendEmail).not.toHaveBeenCalled()
      // Profile lookup should NOT happen
      expect(mockAdminFrom).not.toHaveBeenCalledWith('profiles')
    })

    it('should skip when triggeredByUserId === recipientUserId (self-notification)', async () => {
      const { sendNotification } = await import('@/lib/services/notifications')
      await sendNotification({
        type: 'shift_assigned',
        storeId,
        recipientUserId: 'user-same',
        data: shiftData,
        triggeredByUserId: 'user-same',
      })

      // Should bail out immediately, no supabase calls or emails
      expect(mockSendEmail).not.toHaveBeenCalled()
      expect(mockAdminFrom).not.toHaveBeenCalled()
    })

    it('should use defaults (all true) when no preference record exists', async () => {
      // notification_preferences -> no record found (maybeSingle returns null data)
      // profiles -> return recipient profile
      // alert_history -> insert success
      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'notification_preferences') {
          return createChainableMock({
            data: null,
            error: null,
          })
        }
        if (table === 'profiles') {
          return createChainableMock({
            data: { email: 'recipient@test.com', full_name: 'Bob' },
            error: null,
          })
        }
        if (table === 'alert_history') {
          const mock = createChainableMock({ data: null, error: null })
          mock.insert = vi.fn().mockResolvedValue({ data: null, error: null })
          return mock
        }
        return createChainableMock({ data: null, error: null })
      })

      const { sendNotification } = await import('@/lib/services/notifications')
      await sendNotification({
        type: 'shift_cancelled',
        storeId,
        recipientUserId,
        data: {
          ...shiftData,
        },
        triggeredByUserId,
      })

      // Should still send since no preference record means defaults (all true)
      expect(mockSendEmail).toHaveBeenCalledTimes(1)
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@test.com',
          subject: expect.stringContaining('Shift Cancelled'),
          html: '<html>shift cancelled</html>',
        })
      )
    })

    it('should always send for always-send types (payment_succeeded)', async () => {
      // No notification_preferences lookup should happen for always-send types
      // profiles -> return recipient profile
      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return createChainableMock({
            data: { email: 'owner@test.com', full_name: 'Owner Bob' },
            error: null,
          })
        }
        if (table === 'alert_history') {
          const mock = createChainableMock({ data: null, error: null })
          mock.insert = vi.fn().mockResolvedValue({ data: null, error: null })
          return mock
        }
        return createChainableMock({ data: null, error: null })
      })

      const { sendNotification } = await import('@/lib/services/notifications')
      await sendNotification({
        type: 'payment_succeeded',
        storeId,
        recipientUserId,
        data: {
          storeName: 'Pizza Palace',
          formattedAmount: '\u00a329.99',
          periodLabel: 'Feb 2026',
        },
        triggeredByUserId,
      })

      // Should NOT check notification_preferences for always-send types
      expect(mockAdminFrom).not.toHaveBeenCalledWith('notification_preferences')

      // Email should be sent
      expect(mockSendEmail).toHaveBeenCalledTimes(1)
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'owner@test.com',
          subject: expect.stringContaining('Payment Received'),
          html: '<html>payment succeeded</html>',
        })
      )
    })

    it('should always send for always-send types (subscription_cancelled)', async () => {
      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return createChainableMock({
            data: { email: 'owner@test.com', full_name: 'Owner Bob' },
            error: null,
          })
        }
        if (table === 'alert_history') {
          const mock = createChainableMock({ data: null, error: null })
          mock.insert = vi.fn().mockResolvedValue({ data: null, error: null })
          return mock
        }
        return createChainableMock({ data: null, error: null })
      })

      const { sendNotification } = await import('@/lib/services/notifications')
      await sendNotification({
        type: 'subscription_cancelled',
        storeId,
        recipientUserId,
        data: {
          storeName: 'Pizza Palace',
          accessUntil: '2026-03-25',
        },
        triggeredByUserId,
      })

      // Should NOT check notification_preferences
      expect(mockAdminFrom).not.toHaveBeenCalledWith('notification_preferences')

      // Email should be sent
      expect(mockSendEmail).toHaveBeenCalledTimes(1)
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'owner@test.com',
          subject: expect.stringContaining('Subscription Cancelled'),
          html: '<html>subscription cancelled</html>',
        })
      )
    })

    it('should skip when recipient has no email', async () => {
      // notification_preferences -> no record (defaults to true)
      // profiles -> return profile with no email
      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'notification_preferences') {
          return createChainableMock({
            data: null,
            error: null,
          })
        }
        if (table === 'profiles') {
          return createChainableMock({
            data: { email: null, full_name: 'No Email Bob' },
            error: null,
          })
        }
        return createChainableMock({ data: null, error: null })
      })

      const { sendNotification } = await import('@/lib/services/notifications')
      await sendNotification({
        type: 'shift_assigned',
        storeId,
        recipientUserId,
        data: shiftData,
        triggeredByUserId,
      })

      // Email should NOT be sent because recipient has no email
      expect(mockSendEmail).not.toHaveBeenCalled()
    })

    it('should log to alert_history on success', async () => {
      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'notification_preferences') {
          return createChainableMock({ data: null, error: null })
        }
        if (table === 'profiles') {
          return createChainableMock({
            data: { email: 'recipient@test.com', full_name: 'Bob' },
            error: null,
          })
        }
        if (table === 'alert_history') {
          return { insert: insertMock }
        }
        return createChainableMock({ data: null, error: null })
      })

      const { sendNotification } = await import('@/lib/services/notifications')
      await sendNotification({
        type: 'shift_assigned',
        storeId,
        recipientUserId,
        data: shiftData,
        triggeredByUserId,
      })

      expect(insertMock).toHaveBeenCalledTimes(1)
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          store_id: storeId,
          user_id: recipientUserId,
          alert_type: 'shift_assigned',
          channel: 'email',
          subject: expect.stringContaining('New Shift'),
          item_count: 0,
          status: 'sent',
          error_message: null,
          metadata: { notification_data: shiftData },
        })
      )
    })

    it('should log to alert_history with failed status on email failure', async () => {
      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
      mockSendEmail.mockResolvedValue({ success: false, error: 'SMTP connection refused' })

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'notification_preferences') {
          return createChainableMock({ data: null, error: null })
        }
        if (table === 'profiles') {
          return createChainableMock({
            data: { email: 'recipient@test.com', full_name: 'Bob' },
            error: null,
          })
        }
        if (table === 'alert_history') {
          return { insert: insertMock }
        }
        return createChainableMock({ data: null, error: null })
      })

      const { sendNotification } = await import('@/lib/services/notifications')
      await sendNotification({
        type: 'shift_assigned',
        storeId,
        recipientUserId,
        data: shiftData,
        triggeredByUserId,
      })

      expect(insertMock).toHaveBeenCalledTimes(1)
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          store_id: storeId,
          user_id: recipientUserId,
          alert_type: 'shift_assigned',
          channel: 'email',
          status: 'failed',
          error_message: 'SMTP connection refused',
        })
      )
    })
  })

  describe('notifyStoreManagement', () => {
    it('should send to all owners/managers at the store', async () => {
      const storeUsers = [
        { user_id: 'owner-1', role: 'Owner' },
        { user_id: 'manager-1', role: 'Manager' },
        { user_id: 'manager-2', role: 'Manager' },
      ]

      // Track calls per table to handle multiple sendNotification calls
      // Each sendNotification call triggers: notification_preferences, profiles, alert_history
      const profileEmails: Record<string, string> = {
        'owner-1': 'owner@test.com',
        'manager-1': 'manager1@test.com',
        'manager-2': 'manager2@test.com',
      }

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'store_users') {
          // Return chainable mock that resolves to the store users list
          const mock = createChainableMock({ data: storeUsers, error: null })
          // Override `in` to be thenable with the store users data
          mock.in = vi.fn(() => {
            const result = { data: storeUsers, error: null }
            return {
               
              then: ((resolve?: any) => Promise.resolve(result).then(resolve)) as any,
            }
          })
          return mock
        }
        if (table === 'notification_preferences') {
          // No preference record (defaults to true)
          return createChainableMock({ data: null, error: null })
        }
        if (table === 'profiles') {
          // Return different emails based on the eq chain
          // Since we can't easily track which user_id was queried,
          // return a generic profile — the key assertion is that sendEmail is called 3 times
          const mock = createChainableMock({
            data: { email: 'user@test.com', full_name: 'Test User' },
            error: null,
          })
          return mock
        }
        if (table === 'alert_history') {
          return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) }
        }
        return createChainableMock({ data: null, error: null })
      })

      const { notifyStoreManagement } = await import('@/lib/services/notifications')
      await notifyStoreManagement({
        type: 'delivery_received',
        storeId,
        data: {
          storeName: 'Pizza Palace',
          poNumber: 'PO-001',
          supplierName: 'Fresh Foods',
          receivedByName: 'Staff Alice',
          itemsReceived: 5,
          totalItems: 5,
          totalValue: 150.0,
          currency: 'GBP',
        },
        triggeredByUserId: 'staff-user-1',
      })

      // store_users should be queried for the store
      expect(mockAdminFrom).toHaveBeenCalledWith('store_users')

      // sendEmail should be called once per owner/manager (3 times)
      expect(mockSendEmail).toHaveBeenCalledTimes(3)
    })

    it('should not send any emails when no managers/owners exist', async () => {
      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'store_users') {
          const mock = createChainableMock({ data: [], error: null })
          mock.in = vi.fn(() => {
            const result = { data: [], error: null }
            return {
               
              then: ((resolve?: any) => Promise.resolve(result).then(resolve)) as any,
            }
          })
          return mock
        }
        return createChainableMock({ data: null, error: null })
      })

      const { notifyStoreManagement } = await import('@/lib/services/notifications')
      await notifyStoreManagement({
        type: 'delivery_received',
        storeId,
        data: { storeName: 'Pizza Palace' },
      })

      expect(mockSendEmail).not.toHaveBeenCalled()
    })

    it('should skip the triggeredByUserId recipient (self-notification)', async () => {
      const storeUsers = [
        { user_id: 'owner-1', role: 'Owner' },
        { user_id: 'manager-trigger', role: 'Manager' },
      ]

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'store_users') {
          const mock = createChainableMock({ data: storeUsers, error: null })
          mock.in = vi.fn(() => {
            const result = { data: storeUsers, error: null }
            return {
               
              then: ((resolve?: any) => Promise.resolve(result).then(resolve)) as any,
            }
          })
          return mock
        }
        if (table === 'notification_preferences') {
          return createChainableMock({ data: null, error: null })
        }
        if (table === 'profiles') {
          return createChainableMock({
            data: { email: 'user@test.com', full_name: 'User' },
            error: null,
          })
        }
        if (table === 'alert_history') {
          return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) }
        }
        return createChainableMock({ data: null, error: null })
      })

      const { notifyStoreManagement } = await import('@/lib/services/notifications')
      await notifyStoreManagement({
        type: 'delivery_received',
        storeId,
        data: { storeName: 'Pizza Palace' },
        triggeredByUserId: 'manager-trigger',
      })

      // Only 1 email should be sent (owner-1), not manager-trigger (self)
      expect(mockSendEmail).toHaveBeenCalledTimes(1)
    })
  })

  describe('sendExternalNotification', () => {
    it('should send to external email and log to alert_history', async () => {
      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'alert_history') {
          return { insert: insertMock }
        }
        return createChainableMock({ data: null, error: null })
      })

      const { sendExternalNotification } = await import('@/lib/services/notifications')
      await sendExternalNotification({
        type: 'supplier_portal_invite',
        storeId,
        to: 'supplier@external.com',
        data: {
          supplierName: 'Fresh Foods',
          storeName: 'Pizza Palace',
          portalUrl: 'https://app.example.com/portal/abc123',
          permissions: ['can_view_orders'],
          createdByUserId: 'owner-1',
        },
      })

      // Email should be sent to the external address
      expect(mockSendEmail).toHaveBeenCalledTimes(1)
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'supplier@external.com',
          subject: expect.stringContaining('Supplier Portal Access'),
          html: '<html>supplier portal invite</html>',
        })
      )

      // Alert history should be logged with the external email in metadata
      expect(insertMock).toHaveBeenCalledTimes(1)
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          store_id: storeId,
          user_id: 'owner-1',
          alert_type: 'supplier_portal_invite',
          channel: 'email',
          subject: expect.stringContaining('Supplier Portal Access'),
          item_count: 0,
          status: 'sent',
          error_message: null,
          metadata: expect.objectContaining({
            to: 'supplier@external.com',
          }),
        })
      )
    })

    it('should log failed status when email fails', async () => {
      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
      mockSendEmail.mockResolvedValue({ success: false, error: 'Rejected by server' })

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'alert_history') {
          return { insert: insertMock }
        }
        return createChainableMock({ data: null, error: null })
      })

      const { sendExternalNotification } = await import('@/lib/services/notifications')
      await sendExternalNotification({
        type: 'supplier_portal_invite',
        storeId,
        to: 'bad@external.com',
        data: {
          supplierName: 'Fresh Foods',
          storeName: 'Pizza Palace',
          portalUrl: 'https://app.example.com/portal/abc123',
          permissions: ['can_view_orders'],
          createdByUserId: 'owner-1',
        },
      })

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_message: 'Rejected by server',
        })
      )
    })

    it('should use fallback user_id when createdByUserId is missing', async () => {
      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'alert_history') {
          return { insert: insertMock }
        }
        return createChainableMock({ data: null, error: null })
      })

      const { sendExternalNotification } = await import('@/lib/services/notifications')
      await sendExternalNotification({
        type: 'supplier_portal_invite',
        storeId,
        to: 'supplier@external.com',
        data: {
          supplierName: 'Fresh Foods',
          storeName: 'Pizza Palace',
          portalUrl: 'https://app.example.com/portal/abc123',
          permissions: ['can_view_orders'],
          // no createdByUserId provided
        },
      })

      // Should use the fallback UUID
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: '00000000-0000-0000-0000-000000000000',
        })
      )
    })

    it('should not send email for unknown notification type', async () => {
      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'alert_history') {
          return { insert: insertMock }
        }
        return createChainableMock({ data: null, error: null })
      })

      const { sendExternalNotification } = await import('@/lib/services/notifications')
      await sendExternalNotification({
         
        type: 'unknown_type' as any,
        storeId,
        to: 'supplier@external.com',
        data: {},
      })

      // buildEmail returns null for unknown types, so no email or logging
      expect(mockSendEmail).not.toHaveBeenCalled()
      expect(insertMock).not.toHaveBeenCalled()
    })
  })
})
