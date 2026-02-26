import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { validateCSRFToken } from '@/lib/csrf'
import { auditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'

/**
 * GET /api/users/invites - Get pending invitations
 *
 * Returns all pending (unused, non-expired) invitations for the current user's accessible stores.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's profile and store access
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_platform_admin')
      .eq('id', user.id)
      .single() as { data: { role: string; is_platform_admin: boolean } | null }

    // Get user's accessible stores
    const { data: storeUsers } = await supabase
      .from('store_users')
      .select('store_id, role')
      .eq('user_id', user.id) as { data: { store_id: string; role: string }[] | null }

    const accessibleStoreIds = storeUsers?.map(su => su.store_id) || []
    const canInvite = storeUsers?.some(su => ['Owner', 'Manager'].includes(su.role)) ||
      profile?.role === 'Admin' ||
      profile?.is_platform_admin

    if (!canInvite) {
      return NextResponse.json(
        { success: false, message: 'Not authorized to view invitations' },
        { status: 403 }
      )
    }

    // Fetch pending invitations using admin client for full access
    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAdmin = adminClient as any

    let query = supabaseAdmin
      .from('user_invites')
      .select(`
        id,
        email,
        role,
        store_id,
        store_ids,
        expires_at,
        created_at,
        invited_by,
        store:stores(id, name),
        inviter:profiles!user_invites_invited_by_fkey(id, full_name, email)
      `)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    // Filter by accessible stores (unless platform admin)
    if (!profile?.is_platform_admin && accessibleStoreIds.length > 0) {
      query = query.or(`store_id.in.(${accessibleStoreIds.join(',')}),store_id.is.null`)
    }

    const { data: invites, error } = await query

    if (error) {
      logger.error('[Invites] Fetch error:', { error: error })
      return NextResponse.json(
        { success: false, message: 'Failed to fetch invitations' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: invites || [],
    })
  } catch (error) {
    logger.error('[Invites] Error:', { error: error })
    return NextResponse.json(
      { success: false, message: 'Failed to fetch invitations' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/users/invites - Cancel a pending invitation
 */
export async function DELETE(request: NextRequest) {
  try {
    // CSRF protection
    const isValidCSRF = await validateCSRFToken(request)
    if (!isValidCSRF) {
      return NextResponse.json(
        { success: false, message: 'Invalid or missing CSRF token' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const inviteId = searchParams.get('id')

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

    // Fetch the invite first to check ownership
    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAdmin = adminClient as any

    const { data: invite, error: fetchError } = await supabaseAdmin
      .from('user_invites')
      .select('invited_by, store_id, email, role')
      .eq('id', inviteId)
      .is('used_at', null)
      .single()

    if (fetchError || !invite) {
      return NextResponse.json(
        { success: false, message: 'Invitation not found or already used' },
        { status: 404 }
      )
    }

    // SECURITY: Verify user has permission to delete this invite
    // User must be either: (1) the inviter, or (2) Owner at the invite's store, or (3) platform admin
    const isInviter = invite.invited_by === user.id

    // Check if user is Owner at the invite's store
    let isStoreOwner = false
    if (invite.store_id) {
      const { data: storeUser } = await supabaseAdmin
        .from('store_users')
        .select('role')
        .eq('store_id', invite.store_id)
        .eq('user_id', user.id)
        .single()

      isStoreOwner = storeUser && storeUser.role === 'Owner'
    }

    // Check if platform admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .single()

    const isPlatformAdmin = profile?.is_platform_admin || false

    if (!isInviter && !isStoreOwner && !isPlatformAdmin) {
      return NextResponse.json(
        { success: false, message: 'Not authorized to cancel this invitation' },
        { status: 403 }
      )
    }

    // Delete the invite
    const { error } = await supabaseAdmin
      .from('user_invites')
      .delete()
      .eq('id', inviteId)
      .is('used_at', null) // Only delete unused invites

    if (error) {
      logger.error('[Invites] Delete error:', { error: error })
      return NextResponse.json(
        { success: false, message: 'Failed to cancel invitation' },
        { status: 500 }
      )
    }

    await auditLog(supabaseAdmin, {
      userId: user.id,
      userEmail: user.email,
      action: 'user.invite_cancel',
      storeId: invite.store_id,
      resourceType: 'invitation',
      resourceId: inviteId,
      details: { email: invite.email, role: invite.role },
      request,
    })

    return NextResponse.json({
      success: true,
      message: 'Invitation cancelled',
    })
  } catch (error) {
    logger.error('[Invites] Error:', { error: error })
    return NextResponse.json(
      { success: false, message: 'Failed to cancel invitation' },
      { status: 500 }
    )
  }
}
