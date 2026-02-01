import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

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
      console.error('[Invites] Fetch error:', error)
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
    console.error('[Invites] Error:', error)
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

    // Delete the invite
    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAdmin = adminClient as any

    const { error } = await supabaseAdmin
      .from('user_invites')
      .delete()
      .eq('id', inviteId)
      .is('used_at', null) // Only delete unused invites

    if (error) {
      console.error('[Invites] Delete error:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to cancel invitation' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation cancelled',
    })
  } catch (error) {
    console.error('[Invites] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to cancel invitation' },
      { status: 500 }
    )
  }
}
