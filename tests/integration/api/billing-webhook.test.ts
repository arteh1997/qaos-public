import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Stripe
const mockStripe = {
  webhooks: {
    constructEvent: vi.fn(),
  },
}

vi.mock('@/lib/stripe/config', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
}))

// Mock admin client
const mockAdminClient = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  })),
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}))

// Mock stripe server functions
vi.mock('@/lib/stripe/server', () => ({
  syncSubscriptionToDatabase: vi.fn(() => Promise.resolve()),
  logBillingEvent: vi.fn(() => Promise.resolve()),
}))

// Helper to create mock NextRequest
function createMockRequest(payload: string, signature: string | null): NextRequest {
  const url = new URL('http://localhost:3000/api/billing/webhook')

  const headers = new Headers()
  if (signature) {
    headers.set('stripe-signature', signature)
  }

  return {
    method: 'POST',
    nextUrl: url,
    url: url.toString(),
    text: vi.fn(() => Promise.resolve(payload)),
    headers,
  } as unknown as NextRequest
}

describe('Billing Webhook API Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/billing/webhook', () => {
    describe('Signature Verification', () => {
      it('should return 400 when signature is missing', async () => {
        const { POST } = await import('@/app/api/billing/webhook/route')

        const request = createMockRequest('{}', null)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Missing signature')
      })

      it('should return 400 when signature is invalid', async () => {
        const { stripe } = await import('@/lib/stripe/config')
        vi.mocked(stripe.webhooks.constructEvent).mockImplementation(() => {
          throw new Error('Invalid signature')
        })

        const { POST } = await import('@/app/api/billing/webhook/route')

        const request = createMockRequest('{}', 'invalid-signature')
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Invalid signature')
      })
    })

    describe('Event Handling', () => {
      it('should handle customer.subscription.created event', async () => {
        const { stripe } = await import('@/lib/stripe/config')
        vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
          id: 'evt_test_123',
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_test_123',
              status: 'active',
              metadata: {
                store_id: 'store-123',
                user_id: 'user-123',
              },
            },
          },
        } as any)

        const { POST } = await import('@/app/api/billing/webhook/route')
        const { syncSubscriptionToDatabase, logBillingEvent } = await import('@/lib/stripe/server')

        const request = createMockRequest('{}', 'valid-signature')
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.received).toBe(true)
        expect(syncSubscriptionToDatabase).toHaveBeenCalled()
        expect(logBillingEvent).toHaveBeenCalledWith(
          'customer.subscription.created',
          'store-123',
          'user-123',
          expect.any(Object)
        )
      })

      it('should handle customer.subscription.updated event', async () => {
        const { stripe } = await import('@/lib/stripe/config')
        vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
          id: 'evt_test_123',
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: 'sub_test_123',
              status: 'active',
              metadata: {
                store_id: 'store-123',
                user_id: 'user-123',
              },
            },
          },
        } as any)

        const { POST } = await import('@/app/api/billing/webhook/route')
        const { syncSubscriptionToDatabase } = await import('@/lib/stripe/server')

        const request = createMockRequest('{}', 'valid-signature')
        const response = await POST(request)

        expect(response.status).toBe(200)
        expect(syncSubscriptionToDatabase).toHaveBeenCalled()
      })

      it('should handle customer.subscription.deleted event', async () => {
        const { stripe } = await import('@/lib/stripe/config')
        vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
          id: 'evt_test_123',
          type: 'customer.subscription.deleted',
          data: {
            object: {
              id: 'sub_test_123',
              status: 'canceled',
              metadata: {
                store_id: 'store-123',
              },
            },
          },
        } as any)

        mockAdminClient.from.mockImplementation(() => ({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        }))

        const { POST } = await import('@/app/api/billing/webhook/route')
        const { logBillingEvent } = await import('@/lib/stripe/server')

        const request = createMockRequest('{}', 'valid-signature')
        const response = await POST(request)

        expect(response.status).toBe(200)
        expect(logBillingEvent).toHaveBeenCalledWith(
          'subscription.deleted',
          'store-123',
          null,
          expect.any(Object)
        )
      })

      it('should handle invoice.payment_succeeded event', async () => {
        const { stripe } = await import('@/lib/stripe/config')
        vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
          id: 'evt_test_123',
          type: 'invoice.payment_succeeded',
          data: {
            object: {
              id: 'in_test_123',
              subscription: 'sub_test_123',
              amount_paid: 4999,
              currency: 'usd',
              number: 'INV-001',
            },
          },
        } as any)

        mockAdminClient.from.mockImplementation(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              store_id: 'store-123',
              billing_user_id: 'user-123',
            },
            error: null,
          }),
        }))

        const { POST } = await import('@/app/api/billing/webhook/route')
        const { logBillingEvent } = await import('@/lib/stripe/server')

        const request = createMockRequest('{}', 'valid-signature')
        const response = await POST(request)

        expect(response.status).toBe(200)
        expect(logBillingEvent).toHaveBeenCalledWith(
          'invoice.paid',
          'store-123',
          'user-123',
          expect.objectContaining({
            amountCents: 4999,
            currency: 'usd',
            status: 'paid',
          })
        )
      })

      it('should handle invoice.payment_failed event', async () => {
        const { stripe } = await import('@/lib/stripe/config')
        vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
          id: 'evt_test_123',
          type: 'invoice.payment_failed',
          data: {
            object: {
              id: 'in_test_123',
              subscription: 'sub_test_123',
              amount_due: 4999,
              currency: 'usd',
              attempt_count: 1,
            },
          },
        } as any)

        mockAdminClient.from.mockImplementation(() => ({
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              store_id: 'store-123',
              billing_user_id: 'user-123',
            },
            error: null,
          }),
        }))

        const { POST } = await import('@/app/api/billing/webhook/route')
        const { logBillingEvent } = await import('@/lib/stripe/server')

        const request = createMockRequest('{}', 'valid-signature')
        const response = await POST(request)

        expect(response.status).toBe(200)
        expect(logBillingEvent).toHaveBeenCalledWith(
          'invoice.payment_failed',
          'store-123',
          'user-123',
          expect.objectContaining({
            status: 'failed',
          })
        )
      })

      it('should handle customer.subscription.trial_will_end event', async () => {
        const { stripe } = await import('@/lib/stripe/config')
        vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
          id: 'evt_test_123',
          type: 'customer.subscription.trial_will_end',
          data: {
            object: {
              id: 'sub_test_123',
              status: 'trialing',
              trial_end: Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60, // 3 days from now
              metadata: {
                store_id: 'store-123',
                user_id: 'user-123',
              },
            },
          },
        } as any)

        const { POST } = await import('@/app/api/billing/webhook/route')
        const { logBillingEvent } = await import('@/lib/stripe/server')

        const request = createMockRequest('{}', 'valid-signature')
        const response = await POST(request)

        expect(response.status).toBe(200)
        expect(logBillingEvent).toHaveBeenCalledWith(
          'trial.ending_soon',
          'store-123',
          'user-123',
          expect.any(Object)
        )
      })

      it('should handle unhandled event types gracefully', async () => {
        const { stripe } = await import('@/lib/stripe/config')
        vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
          id: 'evt_test_123',
          type: 'some.unknown.event',
          data: {
            object: {},
          },
        } as any)

        const { POST } = await import('@/app/api/billing/webhook/route')

        const request = createMockRequest('{}', 'valid-signature')
        const response = await POST(request)

        expect(response.status).toBe(200)
        expect((await response.json()).received).toBe(true)
      })

      it('should skip events without store_id', async () => {
        const { stripe } = await import('@/lib/stripe/config')
        vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
          id: 'evt_test_123',
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_test_123',
              status: 'active',
              metadata: {}, // No store_id
            },
          },
        } as any)

        const { POST } = await import('@/app/api/billing/webhook/route')
        const { syncSubscriptionToDatabase } = await import('@/lib/stripe/server')

        const request = createMockRequest('{}', 'valid-signature')
        const response = await POST(request)

        expect(response.status).toBe(200)
        expect(syncSubscriptionToDatabase).not.toHaveBeenCalled()
      })
    })

    describe('Error Handling', () => {
      it('should return 500 when handler fails', async () => {
        const { stripe } = await import('@/lib/stripe/config')
        vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
          id: 'evt_test_123',
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_test_123',
              status: 'active',
              metadata: {
                store_id: 'store-123',
              },
            },
          },
        } as any)

        const { syncSubscriptionToDatabase } = await import('@/lib/stripe/server')
        vi.mocked(syncSubscriptionToDatabase).mockRejectedValue(new Error('Database error'))

        const { POST } = await import('@/app/api/billing/webhook/route')

        const request = createMockRequest('{}', 'valid-signature')
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.error).toBe('Webhook handler failed')
      })
    })
  })
})
