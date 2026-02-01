import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, getInviteEmailHtml } from '@/lib/email'
import crypto from 'crypto'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Restaurant Inventory'

/**
 * POST /api/users/invites/resend - Resend an invitation with a new token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { inviteId } = body

    if (!inviteId) {
      return NextResponse.json(
        { success: false, message: 'Invite ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAdmin = adminClient as any

    // Fetch the existing invite with inviter info
    const { data: invite, error: fetchError } = await supabaseAdmin
      .from('user_invites')
      .select('*, store:stores(id, name), inviter:profiles!user_invites_invited_by_fkey(id, full_name, email)')
      .eq('id', inviteId)
      .is('used_at', null)
      .single()

    if (fetchError || !invite) {
      return NextResponse.json(
        { success: false, message: 'Invitation not found or already used' },
        { status: 404 }
      )
    }

    // Generate a new token and extend expiration
    const newToken = crypto.randomBytes(32).toString('hex')
    const newExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour from now

    // Update the invite with new token and expiration
    const { error: updateError } = await supabaseAdmin
      .from('user_invites')
      .update({
        token: newToken,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inviteId)

    if (updateError) {
      console.error('[Resend] Update error:', updateError)
      return NextResponse.json(
        { success: false, message: 'Failed to update invitation' },
        { status: 500 }
      )
    }

    // Send the new invitation email
    const onboardingUrl = `${APP_URL}/onboard?token=${newToken}`
    const inviterName = invite.inviter?.full_name || invite.inviter?.email || 'Your team'

    const emailHtml = getInviteEmailHtml({
      inviterName,
      role: invite.role,
      storeName: invite.store?.name,
      onboardingUrl,
      expiresIn: '1 hour',
    })

    const emailResult = await sendEmail({
      to: invite.email,
      subject: `Reminder: You're invited to join ${APP_NAME}`,
      html: emailHtml,
    })

    if (!emailResult.success) {
      console.error('[Resend] Email error:', emailResult.error)
      return NextResponse.json(
        { success: false, message: 'Failed to send invitation email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation resent successfully',
    })
  } catch (error) {
    console.error('[Resend] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to resend invitation' },
      { status: 500 }
    )
  }
}
