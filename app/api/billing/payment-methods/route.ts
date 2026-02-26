import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest } from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/config'
import { getPaymentMethods } from '@/lib/stripe/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'

const addPaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1, 'Payment method ID is required'),
})

/**
 * Get the Stripe customer ID for the current user
 */
async function getCustomerId(userId: string): Promise<string | null> {
  const supabase = createAdminClient()

  // Check profiles table first (canonical source)
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id
  }

  // Fallback: check subscriptions table
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('billing_user_id', userId)
    .not('stripe_customer_id', 'is', null)
    .limit(1)
    .single()

  return subscription?.stripe_customer_id || null
}

/**
 * GET /api/billing/payment-methods
 * Fetch payment methods for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth
    const customerId = await getCustomerId(context.user.id)

    if (!customerId) {
      return apiSuccess([], { requestId: context.requestId })
    }

    // Get payment methods and customer's default
    const [paymentMethods, customer] = await Promise.all([
      getPaymentMethods(customerId),
      stripe.customers.retrieve(customerId),
    ])

    if (customer.deleted) {
      return apiSuccess([], { requestId: context.requestId })
    }

    const defaultPmId = typeof customer.invoice_settings?.default_payment_method === 'string'
      ? customer.invoice_settings.default_payment_method
      : customer.invoice_settings?.default_payment_method?.id || null

    const mapped = paymentMethods.map(pm => ({
      id: pm.id,
      brand: pm.card?.brand || 'unknown',
      last4: pm.card?.last4 || '****',
      exp_month: pm.card?.exp_month || 0,
      exp_year: pm.card?.exp_year || 0,
      is_default: pm.id === defaultPmId,
    }))

    return apiSuccess(mapped, { requestId: context.requestId })
  } catch (error) {
    logger.error('Failed to fetch payment methods:', { error: error })
    return apiError(
      error instanceof Error ? error.message : 'Failed to fetch payment methods',
      { status: 500 }
    )
  }
}

/**
 * POST /api/billing/payment-methods
 * Add a new payment method and set as default
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response

    const { context } = auth
    const body = await request.json()

    const validation = addPaymentMethodSchema.safeParse(body)
    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const { paymentMethodId } = validation.data
    const customerId = await getCustomerId(context.user.id)

    if (!customerId) {
      return apiBadRequest('No billing account found. Please subscribe to a store first.', context.requestId)
    }

    // Attach payment method to customer (may already be attached via SetupIntent)
    try {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId })
    } catch (err: unknown) {
      // Ignore "already attached" error
      const stripeErr = err as { code?: string }
      if (stripeErr.code !== 'resource_already_exists') {
        throw err
      }
    }

    // Set as default on customer
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    })

    // Update all active subscriptions for this user
    const supabase = createAdminClient()
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('billing_user_id', context.user.id)
      .in('status', ['active', 'trialing', 'past_due'])
      .not('stripe_subscription_id', 'is', null)

    if (subscriptions) {
      await Promise.all(
        subscriptions.map(sub =>
          stripe.subscriptions.update(sub.stripe_subscription_id!, {
            default_payment_method: paymentMethodId,
          })
        )
      )
    }

    // Get the card details to return
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId)

    return apiSuccess({
      id: pm.id,
      brand: pm.card?.brand || 'unknown',
      last4: pm.card?.last4 || '****',
      exp_month: pm.card?.exp_month || 0,
      exp_year: pm.card?.exp_year || 0,
      is_default: true,
    }, { requestId: context.requestId })
  } catch (error) {
    logger.error('Failed to add payment method:', { error: error })
    return apiError(
      error instanceof Error ? error.message : 'Failed to add payment method',
      { status: 500 }
    )
  }
}
