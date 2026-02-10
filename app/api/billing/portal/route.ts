import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { apiSuccess, apiError } from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/config'

/**
 * POST /api/billing/portal
 * Create a Stripe Customer Portal session for managing payment methods and invoices
 *
 * Body:
 * - storeId (optional): Store ID to return to after portal session
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
    const supabase = createAdminClient()

    // Parse request body to get optional storeId
    let storeId: string | undefined
    try {
      const body = await request.json()
      storeId = body.storeId
    } catch {
      // No body or invalid JSON - that's okay, storeId is optional
    }

    // Get user's subscriptions to find their Stripe customer ID
    const { data: subscriptions, error: subsError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('billing_user_id', context.user.id)
      .not('stripe_customer_id', 'is', null)
      .limit(1)
      .single()

    if (subsError || !subscriptions?.stripe_customer_id) {
      return apiError('No active subscription found. Please subscribe to a store first.', { status: 404 })
    }

    // Build return URL with store context if provided
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const returnUrl = storeId
      ? `${baseUrl}/billing?store=${storeId}`
      : `${baseUrl}/billing`

    // Create a portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: subscriptions.stripe_customer_id,
      return_url: returnUrl,
    })

    return apiSuccess({ url: session.url })
  } catch (error) {
    console.error('Failed to create portal session:', error)
    return apiError(
      error instanceof Error ? error.message : 'Failed to create portal session',
      { status: 500 }
    )
  }
}
