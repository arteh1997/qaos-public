import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { apiSuccess, apiError } from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { getOrCreateCustomer, createSetupIntent } from '@/lib/stripe/server'

/**
 * POST /api/billing/setup-intent
 * Create a Setup Intent for collecting payment method
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withApiAuth(request, {
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth

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
    console.error('Error creating setup intent:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to create setup intent')
  }
}
