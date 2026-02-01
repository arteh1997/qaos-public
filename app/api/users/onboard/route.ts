import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { onboardingSchema } from '@/lib/validations/user'
import { sendEmail, getWelcomeEmailHtml } from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate the request body
    const validationResult = onboardingSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: validationResult.error.issues.map(e => e.message).join(', ')
        },
        { status: 400 }
      )
    }

    const { token, firstName, lastName, phone, password } = validationResult.data

    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAdmin = adminClient as any

    // Fetch and validate the invite
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('user_invites')
      .select('id, email, role, store_id, store_ids, expires_at, used_at, store:stores(id, name)')
      .eq('token', token)
      .single()

    if (inviteError || !invite) {
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

    const fullName = `${firstName} ${lastName}`.trim()

    // Create the user in Supabase Auth
    const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
      email: invite.email,
      password: password,
      email_confirm: true, // Auto-confirm since they clicked the invite link
      user_metadata: {
        full_name: fullName,
        role: invite.role,
      },
    })

    if (createError) {
      console.error('[Onboard] Create user error:', createError)
      return NextResponse.json(
        { success: false, message: createError.message },
        { status: 400 }
      )
    }

    if (!userData.user) {
      return NextResponse.json(
        { success: false, message: 'Failed to create user account' },
        { status: 500 }
      )
    }

    // Determine store_id for single-store roles
    const profileStoreId = ['Staff', 'Manager'].includes(invite.role)
      ? invite.store_id || null
      : null

    // Update the profile with user data (including phone number)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: fullName,
        phone: phone || null,
        role: invite.role,
        store_id: profileStoreId,
        status: 'Active',
      })
      .eq('id', userData.user.id)

    if (profileError) {
      console.error('[Onboard] Profile update error:', profileError)
      // Don't fail - user is created, profile can be updated manually
    }

    // Add user to store_users for their assigned store(s)
    if (invite.store_id) {
      // Single store assignment (Owner/Co-Owner, Manager, Staff)
      const { error: storeUserError } = await supabaseAdmin
        .from('store_users')
        .insert({
          store_id: invite.store_id,
          user_id: userData.user.id,
          role: invite.role,
          is_billing_owner: false, // Never for invited users
          invited_by: null, // Could fetch from invite if needed
        })

      if (storeUserError) {
        console.error('[Onboard] Store user insert error:', storeUserError)
      }
    }

    // Handle Driver multi-store assignment
    if (invite.role === 'Driver' && invite.store_ids && invite.store_ids.length > 0) {
      for (const storeId of invite.store_ids) {
        const { error: driverStoreError } = await supabaseAdmin
          .from('store_users')
          .insert({
            store_id: storeId,
            user_id: userData.user.id,
            role: 'Driver',
            is_billing_owner: false,
          })

        if (driverStoreError) {
          console.error('[Onboard] Driver store insert error:', driverStoreError)
        }
      }
    }

    // Mark the invite as used
    await supabaseAdmin
      .from('user_invites')
      .update({ used_at: new Date().toISOString() })
      .eq('id', invite.id)

    // Send welcome email
    const welcomeHtml = getWelcomeEmailHtml({
      firstName,
      role: invite.role,
      storeName: invite.store?.name,
      loginUrl: `${APP_URL}/login`,
    })

    await sendEmail({
      to: invite.email,
      subject: `Welcome to ${process.env.NEXT_PUBLIC_APP_NAME || 'Mr Fries Inventory'}!`,
      html: welcomeHtml,
    })

    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
      data: {
        email: invite.email,
        role: invite.role,
      },
    })
  } catch (error) {
    console.error('[Onboard] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to complete registration' },
      { status: 500 }
    )
  }
}
