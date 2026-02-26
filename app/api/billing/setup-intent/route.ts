import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { apiSuccess, apiError } from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { getOrCreateCustomer, createSetupIntent } from '@/lib/stripe/server'
import { logger } from '@/lib/logger'

/**
 * POST /api/billing/setup-intent
 * Create a Setup Intent for collecting payment method
 *
 * SECURITY: Only billing owners can set up payment methods
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner'], // Only Owners can set up billing
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // SECURITY: Verify user is a billing owner for at least one store
    // Billing setup should only be available to users who pay for stores
    const isBillingOwner = context.stores.some(s => s.is_billing_owner)

    if (!isBillingOwner && !context.profile?.is_platform_admin) {
      return apiError(
        'Only billing owners can set up payment methods',
        { status: 403, requestId: context.requestId }
      )
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateCustomer(
      context.user.id,
      context.user.email || ''
    )

    // Create setup intent
    const setupIntent = await createSetupIntent(customerId)

    return apiSuccess({
      clientSecret: setupIntent.client_secret,
      customerId,
    }, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error creating setup intent:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to create setup intent')
  }
}
