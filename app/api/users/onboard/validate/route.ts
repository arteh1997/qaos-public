import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Invalid invitation link' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAdmin = adminClient as any

    // Fetch the invite with store info
    const { data: invite, error } = await supabaseAdmin
      .from('user_invites')
      .select('id, email, role, store_id, expires_at, used_at, store:stores(name)')
      .eq('token', token)
      .single()

    if (error || !invite) {
      return NextResponse.json(
        { success: false, message: 'Invalid invitation link' },
        { status: 404 }
      )
    }

    // Check if already used
    if (invite.used_at) {
      return NextResponse.json(
        { success: false, message: 'This invitation has already been used' },
        { status: 409 }
      )
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, message: 'This invitation has expired' },
        { status: 410 }
      )
    }

    // Return invite details for display
    return NextResponse.json({
      success: true,
      data: {
        email: invite.email,
        role: invite.role,
        storeName: invite.store?.name || undefined,
      },
    })
  } catch (error) {
    console.error('[Onboard Validate] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to validate invitation' },
      { status: 500 }
    )
  }
}
