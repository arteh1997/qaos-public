import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest, apiForbidden, apiNotFound } from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  cancelSubscription,
  reactivateSubscription,
  syncSubscriptionToDatabase,
  logBillingEvent,
} from '@/lib/stripe/server'
import { stripe } from '@/lib/stripe/config'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ subscriptionId: string }>
}

const updateSubscriptionSchema = z.object({
  action: z.enum(['cancel', 'reactivate']),
  cancel_immediately: z.boolean().optional(),
})

/**
 * GET /api/billing/subscriptions/:subscriptionId
 * Get a specific subscription
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { subscriptionId } = await params

    const auth = await withApiAuth(request, {
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth
    const supabaseAdmin = createAdminClient()

    // Get subscription
    const { data: subscription, error } = await supabaseAdmin
      .from('subscriptions')
      .select(`
        *,
        store:stores(id, name)
      `)
      .eq('id', subscriptionId)
      .single()

    if (error || !subscription) {
      return apiNotFound('Subscription', context.requestId)
    }

    // Verify user has access (is billing owner or store owner)
    const { data: storeUser } = await supabaseAdmin
      .from('store_users')
      .select('role, is_billing_owner')
      .eq('store_id', subscription.store_id)
      .eq('user_id', context.user.id)
      .single()

    if (!storeUser || (storeUser.role !== 'Owner' && !storeUser.is_billing_owner)) {
      return apiForbidden('You do not have access to this subscription', context.requestId)
    }

    return apiSuccess(subscription, { requestId: context.requestId })
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to fetch subscription')
  }
}

/**
 * PATCH /api/billing/subscriptions/:subscriptionId
 * Update a subscription (cancel/reactivate)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { subscriptionId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth
    const body = await request.json()

    // Validate input
    const validationResult = updateSubscriptionSchema.safeParse(body)
    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const { action, cancel_immediately } = validationResult.data
    const supabaseAdmin = createAdminClient()

    // Get subscription
    const { data: dbSubscription, error: fetchError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single()

    if (fetchError || !dbSubscription) {
      return apiNotFound('Subscription', context.requestId)
    }

    // Verify user is billing owner
    const { data: storeUser } = await supabaseAdmin
      .from('store_users')
      .select('is_billing_owner')
      .eq('store_id', dbSubscription.store_id)
      .eq('user_id', context.user.id)
      .single()

    if (!storeUser?.is_billing_owner) {
      return apiForbidden('Only the billing owner can manage the subscription', context.requestId)
    }

    if (!dbSubscription.stripe_subscription_id) {
      return apiBadRequest('No Stripe subscription found', context.requestId)
    }

    let stripeSubscription

    if (action === 'cancel') {
      stripeSubscription = await cancelSubscription(
        dbSubscription.stripe_subscription_id,
        cancel_immediately
      )

      await logBillingEvent(
        cancel_immediately ? 'subscription.canceled' : 'subscription.cancel_scheduled',
        dbSubscription.store_id,
        context.user.id,
        {
          subscriptionId: dbSubscription.id,
          status: stripeSubscription.status,
        }
      )
    } else if (action === 'reactivate') {
      if (!dbSubscription.cancel_at_period_end) {
        return apiBadRequest('Subscription is not scheduled for cancellation', context.requestId)
      }

      stripeSubscription = await reactivateSubscription(dbSubscription.stripe_subscription_id)

      await logBillingEvent('subscription.reactivated', dbSubscription.store_id, context.user.id, {
        subscriptionId: dbSubscription.id,
        status: stripeSubscription.status,
      })
    } else {
      return apiBadRequest('Invalid action', context.requestId)
    }

    // Sync to database
    await syncSubscriptionToDatabase(stripeSubscription, dbSubscription.store_id)

    // Fetch updated subscription
    const { data: updatedSubscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single()

    return apiSuccess(updatedSubscription, { requestId: context.requestId })
  } catch (error) {
    console.error('Error updating subscription:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to update subscription')
  }
}
