import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inviteUserSchema } from '@/lib/validations/user'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { withApiAuth } from '@/lib/api/middleware'
import { INVITABLE_ROLES_BY_ROLE } from '@/lib/constants'
import { sendEmail, getInviteEmailHtml } from '@/lib/email'
import { auditLog } from '@/lib/audit'
import { AppRole } from '@/types'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
} from '@/lib/api/response'
import crypto from 'crypto'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const INVITE_EXPIRY_HOURS = 1

export async function POST(request: NextRequest) {
  try {
    // Allow both Owners and Managers to invite (with restrictions)
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'createUser', config: RATE_LIMITS.createUser },
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

    // Get the inviter's role at the relevant store to check permissions
    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAdmin = adminClient as any

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
      // For Driver invites (no store), check if user is Owner at any store
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

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(
      u => u.email?.toLowerCase() === validatedData.email.toLowerCase()
    )

    // If user exists, add them directly to the store (no invite needed)
    if (existingUser) {
      // Get their profile
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', existingUser.id)
        .single()

      if (!existingProfile) {
        return apiBadRequest(
          'User account exists but profile not found. Please contact support.',
          context.requestId
        )
      }

      // Determine store IDs to add
      const storeIdsToAdd = validatedData.storeIds || (validatedData.storeId ? [validatedData.storeId] : [])

      if (storeIdsToAdd.length === 0) {
        return apiBadRequest(
          'No store specified for invitation',
          context.requestId
        )
      }

      // Check if user is already a member of any of these stores
      const { data: existingMemberships } = await supabaseAdmin
        .from('store_users')
        .select('store_id')
        .eq('user_id', existingUser.id)
        .in('store_id', storeIdsToAdd)

      const existingStoreIds = new Set(existingMemberships?.map(m => m.store_id) || [])
      const newStoreIds = storeIdsToAdd.filter(id => !existingStoreIds.has(id))

      if (newStoreIds.length === 0) {
        return apiBadRequest(
          'This user is already a member of this store',
          context.requestId
        )
      }

      // Add user to the new stores
      const insertData = newStoreIds.map(storeId => ({
        store_id: storeId,
        user_id: existingUser.id,
        role: validatedData.role,
        invited_by: context.user.id,
      }))

      const { error: insertError } = await supabaseAdmin
        .from('store_users')
        .insert(insertData)

      if (insertError) {
        console.error('Error adding user to store:', insertError)
        return apiError('Failed to add user to store')
      }

      // Get store name for response
      let storeName: string | undefined
      if (validatedData.storeId) {
        const { data: store } = await supabaseAdmin
          .from('stores')
          .select('name')
          .eq('id', validatedData.storeId)
          .single()
        storeName = store?.name
      }

      // Audit log
      await auditLog(supabaseAdmin, {
        userId: context.user.id,
        userEmail: context.user.email,
        action: 'user.add_to_store',
        storeId: validatedData.storeId || null,
        resourceType: 'store_users',
        details: {
          addedUserId: existingUser.id,
          addedEmail: validatedData.email,
          role: validatedData.role,
          storeName,
          storeIds: newStoreIds,
        },
        request,
      })

      return apiSuccess(
        {
          message: `${validatedData.email} has been added to the store as ${validatedData.role}`,
          email: validatedData.email,
          addedToExisting: true,
        },
        { requestId: context.requestId, status: 201 }
      )
    }

    // Check if there's an existing pending invite for this email
    const { data: existingInvite } = await supabaseAdmin
      .from('user_invites')
      .select('id, expires_at')
      .eq('email', validatedData.email.toLowerCase())
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (existingInvite) {
      return apiBadRequest(
        'An active invitation already exists for this email address',
        context.requestId
      )
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000)

    // Create the invite record
    const { error: insertError } = await supabaseAdmin
      .from('user_invites')
      .insert({
        email: validatedData.email.toLowerCase(),
        role: validatedData.role,
        store_id: validatedData.storeId || null,
        store_ids: validatedData.storeIds || [],
        token,
        invited_by: context.user.id,
        expires_at: expiresAt.toISOString(),
      })

    if (insertError) {
      console.error('Insert invite error:', insertError)
      return apiError('Failed to create invitation')
    }

    // Get store name for the email
    let storeName: string | undefined
    if (validatedData.storeId) {
      const { data: store } = await supabaseAdmin
        .from('stores')
        .select('name')
        .eq('id', validatedData.storeId)
        .single()

      storeName = store?.name
    }

    // Get inviter's name
    const { data: inviterProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', context.user.id)
      .single()

    const inviterName = inviterProfile?.full_name || inviterProfile?.email || 'A team member'

    // Send invitation email
    const onboardingUrl = `${APP_URL}/onboard?token=${token}`
    const emailHtml = getInviteEmailHtml({
      inviterName,
      role: validatedData.role,
      storeName,
      onboardingUrl,
      expiresIn: `${INVITE_EXPIRY_HOURS} hour${INVITE_EXPIRY_HOURS > 1 ? 's' : ''}`,
    })

    const emailResult = await sendEmail({
      to: validatedData.email,
      subject: `You've been invited to join ${process.env.NEXT_PUBLIC_APP_NAME || 'Mr Fries Inventory'}`,
      html: emailHtml,
    })

    if (!emailResult.success) {
      // Delete the invite if email fails
      await supabaseAdmin
        .from('user_invites')
        .delete()
        .eq('token', token)

      return apiError('Failed to send invitation email. Please try again.')
    }

    // Audit log the invitation
    await auditLog(supabaseAdmin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'user.invite',
      storeId: validatedData.storeId || null,
      resourceType: 'user_invite',
      details: {
        invitedEmail: validatedData.email,
        role: validatedData.role,
        storeName,
      },
      request,
    })

    return apiSuccess(
      {
        message: 'Invitation sent successfully',
        email: validatedData.email,
        expiresAt: expiresAt.toISOString(),
      },
      { requestId: context.requestId, status: 201 }
    )
  } catch (error) {
    console.error('Error inviting user:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to invite user')
  }
}
