import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { apiSuccess, apiError } from '@/lib/api/response'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

/**
 * GET /api/users/account-type - Check if user can create stores
 *
 * Returns canCreateStores: true for users who signed up directly
 * Returns canCreateStores: false for users who were invited (employees)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withApiAuth(request)

    if (!auth.success) return auth.response

    const { context } = auth
    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAdmin = adminClient as any

    // Check if user was ever invited via the invite system
    const { data: inviteRecord } = await supabaseAdmin
      .from('user_invites')
      .select('id')
      .eq('email', context.user.email?.toLowerCase())
      .limit(1)
      .single()

    // Also check if user was ever a billing owner (they can create stores)
    const { data: billingOwnerRecord } = await supabaseAdmin
      .from('store_users')
      .select('id')
      .eq('user_id', context.user.id)
      .eq('is_billing_owner', true)
      .limit(1)
      .single()

    // User can create stores if:
    // 1. They were never invited (signed up directly), OR
    // 2. They were/are a billing owner of a store
    const canCreateStores = !inviteRecord || !!billingOwnerRecord

    return apiSuccess(
      { canCreateStores },
      { requestId: context.requestId }
    )
  } catch (error) {
    logger.error('Error checking account type:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to check account type')
  }
}
