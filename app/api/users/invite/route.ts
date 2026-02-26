import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inviteUserSchema } from '@/lib/validations/user'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { withApiAuth } from '@/lib/api/middleware'
import { INVITABLE_ROLES_BY_ROLE } from '@/lib/constants'
import { debugError } from '@/lib/debug'
import { AppRole } from '@/types'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
} from '@/lib/api/response'
import {
  handleExistingUserInvite,
  handleNewUserInvite,
} from '@/lib/services/userInvitation'

export async function POST(request: NextRequest) {
  try {
    // Allow both Owners and Managers to invite (with restrictions)
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'createUser', config: RATE_LIMITS.createUser },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // Parse and validate request body
    const body = await request.json()
    const validationResult = inviteUserSchema.safeParse(body)

    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const validatedData = validationResult.data

    // Prevent self-invitation
    if (context.user.email?.toLowerCase() === validatedData.email.toLowerCase()) {
      return apiBadRequest('You cannot invite yourself', context.requestId)
    }

    // Get the inviter's role at the relevant store to check permissions
    const supabaseAdmin = createAdminClient()

    // Determine inviter's highest role at the target store
    let inviterRole: AppRole = 'Staff' // Default lowest

    if (validatedData.storeId) {
      const { data: storeUser } = await supabaseAdmin
        .from('store_users')
        .select('role')
        .eq('user_id', context.user.id)
        .eq('store_id', validatedData.storeId)
        .single()

      if (storeUser) {
        inviterRole = storeUser.role as AppRole
      }
    } else {
      // For invites without a specific store, check if user is Owner at any store
      const { data: storeUsers } = await supabaseAdmin
        .from('store_users')
        .select('role')
        .eq('user_id', context.user.id)
        .in('role', ['Owner', 'Manager'])

      if (storeUsers && storeUsers.length > 0) {
        // Use highest role
        inviterRole = storeUsers.some((su: { role: string }) => su.role === 'Owner') ? 'Owner' : 'Manager'
      }
    }

    // Check if inviter can invite this role
    const invitableRoles = INVITABLE_ROLES_BY_ROLE[inviterRole] || []
    if (!invitableRoles.includes(validatedData.role as AppRole)) {
      return apiForbidden(
        `You don't have permission to invite users with the ${validatedData.role} role`,
        context.requestId
      )
    }

    // Check if user already exists and has completed onboarding
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(
      u => u.email?.toLowerCase() === validatedData.email.toLowerCase()
    )

    if (existingUser) {
      // Get their profile to check onboarding status
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, status')
        .eq('id', existingUser.id)
        .single()

      if (!existingProfile) {
        return apiBadRequest(
          'User account exists but profile not found. Please contact support.',
          context.requestId
        )
      }

      // If user hasn't completed onboarding, they need to finish that first
      if (existingProfile.status === 'Invited') {
        return apiBadRequest(
          'This user has a pending invitation. They need to complete their account setup first before being added to another store.',
          context.requestId
        )
      }

      // User has completed onboarding - add them directly to the store
      const result = await handleExistingUserInvite(
        supabaseAdmin,
        validatedData,
        existingUser.id,
        { userId: context.user.id, userEmail: context.user.email ?? '' },
        request
      )

      if (!result.success) {
        return apiBadRequest(result.error || 'Failed to add user to store', context.requestId)
      }

      return apiSuccess(
        {
          message: `${validatedData.email} has been added to the store as ${validatedData.role}`,
          email: validatedData.email,
          addedToExisting: true,
        },
        { requestId: context.requestId, status: 201 }
      )
    }

    // New user - send invitation
    const result = await handleNewUserInvite(
      supabaseAdmin,
      validatedData,
      { userId: context.user.id, userEmail: context.user.email ?? '' },
      request
    )

    if (!result.success) {
      return apiBadRequest(result.error || 'Failed to send invitation', context.requestId)
    }

    return apiSuccess(
      {
        message: 'Invitation sent successfully',
        email: validatedData.email,
        expiresAt: result.expiresAt,
      },
      { requestId: context.requestId, status: 201 }
    )
  } catch (error) {
    debugError('UserInvite', 'Error inviting user:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to invite user')
  }
}
