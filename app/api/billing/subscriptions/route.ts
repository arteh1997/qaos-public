import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest } from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getOrCreateCustomer,
  createSubscription,
  syncSubscriptionToDatabase,
  logBillingEvent,
} from '@/lib/stripe/server'
import { z } from 'zod'

// Types for Supabase admin client query results
interface StoreUserRow {
  role: string
  is_billing_owner: boolean
  store_id?: string
}

interface SubscriptionRow {
  id: string
  status: string
  store_id: string
  billing_user_id: string
}

const createSubscriptionSchema = z.object({
  store_id: z.string().uuid('Invalid store ID'),
  payment_method_id: z.string().min(1, 'Payment method is required'),
})

/**
 * POST /api/billing/subscriptions
 * Create a new subscription for a store
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth
    const body = await request.json()

    // Validate input
    const validationResult = createSubscriptionSchema.safeParse(body)
    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const { store_id, payment_method_id } = validationResult.data

    const supabaseAdmin = createAdminClient()

    // Verify user is the billing owner of this store
    const { data: storeUserData } = await supabaseAdmin
      .from('store_users')
      .select('role, is_billing_owner')
      .eq('store_id', store_id)
      .eq('user_id', context.user.id)
      .single()

    const storeUser = storeUserData as StoreUserRow | null

    if (!storeUser?.is_billing_owner) {
      return apiBadRequest(
        'Only the billing owner can create a subscription',
        context.requestId
      )
    }

    // Check if store already has an active subscription
    const { data: existingSubData } = await supabaseAdmin
      .from('subscriptions')
      .select('id, status')
      .eq('store_id', store_id)
      .single()

    const existingSubscription = existingSubData as SubscriptionRow | null

    if (existingSubscription && ['active', 'trialing'].includes(existingSubscription.status)) {
      return apiBadRequest(
        'This store already has an active subscription',
        context.requestId
      )
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateCustomer(
      context.user.id,
      context.user.email || ''
    )

    // Create subscription with trial
    const subscription = await createSubscription(
      customerId,
      payment_method_id,
      store_id,
      context.user.id
    )

    // Sync to database
    await syncSubscriptionToDatabase(subscription, store_id)

    // Log billing event
    await logBillingEvent('subscription.created', store_id, context.user.id, {
      subscriptionId: subscription.id,
      status: subscription.status,
      metadata: {
        trial_days: 30,
        payment_method_id,
      },
    })

    return apiSuccess({
      subscriptionId: subscription.id,
      status: subscription.status,
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
    }, { requestId: context.requestId, status: 201 })
  } catch (error) {
    console.error('Error creating subscription:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to create subscription')
  }
}

/**
 * GET /api/billing/subscriptions
 * Get subscriptions for the current user's stores
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withApiAuth(request, {
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')

    const supabaseAdmin = createAdminClient()

    let query = supabaseAdmin
      .from('subscriptions')
      .select(`
        *,
        store:stores(id, name)
      `)

    if (storeId) {
      query = query.eq('store_id', storeId)
    } else {
      // Get subscriptions for stores user owns
      const { data: userStoresData } = await supabaseAdmin
        .from('store_users')
        .select('store_id')
        .eq('user_id', context.user.id)
        .eq('role', 'Owner')

      const userStores = (userStoresData || []) as { store_id: string }[]
      const storeIds = userStores.map(s => s.store_id)
      if (storeIds.length === 0) {
        return apiSuccess([], { requestId: context.requestId })
      }

      query = query.in('store_id', storeIds)
    }

    const { data: subscriptions, error } = await query

    if (error) throw error

    return apiSuccess(subscriptions, { requestId: context.requestId })
  } catch (error) {
    console.error('Error fetching subscriptions:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to fetch subscriptions')
  }
}
