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
import { z } from 'zod'

// Type for subscription row from database
interface SubscriptionRow {
  id: string
  store_id: string
  billing_user_id: string
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  stripe_payment_method_id: string | null
  status: string
  trial_start: string | null
  trial_end: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

// Type for store user query result
interface StoreUserRow {
  role: string
  is_billing_owner: boolean
}

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
    const { data: subscriptionData, error } = await supabaseAdmin
      .from('subscriptions')
      .select(`
        *,
        store:stores(id, name)
      `)
      .eq('id', subscriptionId)
      .single()

    if (error || !subscriptionData) {
      return apiNotFound('Subscription', context.requestId)
    }

    const subscription = subscriptionData as SubscriptionRow & { store: { id: string; name: string } | null }

    // Verify user has access (is billing owner or store owner)
    const { data: storeUserData } = await supabaseAdmin
      .from('store_users')
      .select('role, is_billing_owner')
      .eq('store_id', subscription.store_id)
      .eq('user_id', context.user.id)
      .single()

    const storeUser = storeUserData as StoreUserRow | null

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
      requireCSRF: true,
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
    const { data: subscriptionResult, error: fetchError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single()

    if (fetchError || !subscriptionResult) {
      return apiNotFound('Subscription', context.requestId)
    }

    const dbSubscription = subscriptionResult as SubscriptionRow

    // Verify user is billing owner
    const { data: storeUserData } = await supabaseAdmin
      .from('store_users')
      .select('is_billing_owner')
      .eq('store_id', dbSubscription.store_id)
      .eq('user_id', context.user.id)
      .single()

    const storeUser = storeUserData as { is_billing_owner: boolean } | null

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
