import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withApiAuth } from '@/lib/api/middleware'
import { RATE_LIMITS } from '@/lib/rate-limit'
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
import { bulkImportSchema, BulkUserRow } from '@/lib/validations/bulk-import'
import crypto from 'crypto'
import { logger } from '@/lib/logger'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Restaurant Inventory'
const INVITE_EXPIRY_HOURS = 24 // Longer expiry for bulk imports

interface ImportResult {
  email: string
  status: 'success' | 'error' | 'skipped'
  message: string
}

/**
 * POST /api/users/bulk-import - Import multiple users via CSV data
 *
 * Only Owners can bulk import users.
 */
export async function POST(request: NextRequest) {
  try {
    // Only Owners can bulk import
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner'],
      rateLimit: { key: 'createUser', config: RATE_LIMITS.createUser },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response

    const { context } = auth
    const body = await request.json()

    // Validate input
    const validationResult = bulkImportSchema.safeParse(body)
    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const { users, defaultStoreId } = validationResult.data

    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAdmin = adminClient as any

    // Get inviter's profile
    const { data: inviterProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', context.user.id)
      .single()

    const inviterName = inviterProfile?.full_name || inviterProfile?.email || 'Your team'

    // Get inviter's highest role
    const { data: inviterStores } = await supabaseAdmin
      .from('store_users')
      .select('role')
      .eq('user_id', context.user.id)
      .eq('role', 'Owner')

    const inviterRole: AppRole = inviterStores && inviterStores.length > 0 ? 'Owner' : 'Manager'
    const invitableRoles = INVITABLE_ROLES_BY_ROLE[inviterRole] || []

    // Get existing users and invites
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingEmails = new Set(
      existingUsers?.users?.map(u => u.email?.toLowerCase()) || []
    )

    const userEmails = users.map(u => u.email.toLowerCase())
    const { data: existingInvites } = await supabaseAdmin
      .from('user_invites')
      .select('email')
      .in('email', userEmails)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())

    const existingInviteEmails = new Set(
      (existingInvites || []).map((i: { email: string }) => i.email.toLowerCase())
    )

    // Get store names for emails
    const storeIds = [...new Set(users.map(u => u.storeId || defaultStoreId).filter(Boolean))]
    const { data: stores } = await supabaseAdmin
      .from('stores')
      .select('id, name')
      .in('id', storeIds)

    const storeMap = new Map<string, string>(
      (stores || []).map((s: { id: string; name: string }) => [s.id, s.name])
    )

    // Process each user
    const results: ImportResult[] = []
    const successfulInvites: { email: string; role: string; storeId?: string }[] = []

    for (const user of users) {
      const email = user.email.toLowerCase()
      const storeId = user.storeId || defaultStoreId

      // Check if role is invitable
      if (!invitableRoles.includes(user.role)) {
        results.push({
          email,
          status: 'error',
          message: `Cannot invite users with ${user.role} role`,
        })
        continue
      }

      // Check if user already exists
      if (existingEmails.has(email)) {
        results.push({
          email,
          status: 'skipped',
          message: 'User already exists',
        })
        continue
      }

      // Check if invite already pending
      if (existingInviteEmails.has(email)) {
        results.push({
          email,
          status: 'skipped',
          message: 'Invitation already pending',
        })
        continue
      }

      // All roles require a store
      if (!storeId) {
        results.push({
          email,
          status: 'error',
          message: 'Store ID is required',
        })
        continue
      }

      // Create invite
      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000)

      const { error: insertError } = await supabaseAdmin
        .from('user_invites')
        .insert({
          email,
          role: user.role,
          store_id: storeId || null,
          store_ids: [],
          token,
          invited_by: context.user.id,
          expires_at: expiresAt.toISOString(),
        })

      if (insertError) {
        results.push({
          email,
          status: 'error',
          message: 'Failed to create invitation',
        })
        continue
      }

      // Send email
      const storeName = storeId ? storeMap.get(storeId) : undefined
      const onboardingUrl = `${APP_URL}/onboard?token=${token}`
      const emailHtml = getInviteEmailHtml({
        inviterName,
        role: user.role,
        storeName,
        onboardingUrl,
        expiresIn: `${INVITE_EXPIRY_HOURS} hours`,
      })

      const emailResult = await sendEmail({
        to: email,
        subject: `You've been invited to join ${APP_NAME}`,
        html: emailHtml,
      })

      if (!emailResult.success) {
        // Delete the invite if email fails
        await supabaseAdmin
          .from('user_invites')
          .delete()
          .eq('token', token)

        results.push({
          email,
          status: 'error',
          message: 'Failed to send invitation email',
        })
        continue
      }

      results.push({
        email,
        status: 'success',
        message: 'Invitation sent',
      })

      successfulInvites.push({ email, role: user.role, storeId })
    }

    // Audit log the bulk import
    await auditLog(supabaseAdmin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'user.invite',
      resourceType: 'bulk_import',
      details: {
        totalAttempted: users.length,
        successful: results.filter(r => r.status === 'success').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        failed: results.filter(r => r.status === 'error').length,
        invites: successfulInvites,
      },
      request,
    })

    const summary = {
      total: users.length,
      successful: results.filter(r => r.status === 'success').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      failed: results.filter(r => r.status === 'error').length,
    }

    return apiSuccess(
      {
        message: `Processed ${users.length} users: ${summary.successful} invited, ${summary.skipped} skipped, ${summary.failed} failed`,
        summary,
        results,
      },
      { requestId: context.requestId, status: 201 }
    )
  } catch (error) {
    logger.error('[BulkImport] Error:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to process bulk import')
  }
}
