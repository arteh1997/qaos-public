import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inviteUserSchema } from '@/lib/validations/user'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { withApiAuth } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
} from '@/lib/api/response'

export async function POST(request: NextRequest) {
  try {
    const auth = await withApiAuth(request, {
      allowedRoles: ['Admin'],
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

    // Use admin client to create user
    const adminClient = createAdminClient()

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(
      u => u.email?.toLowerCase() === validatedData.email.toLowerCase()
    )

    if (existingUser) {
      return apiBadRequest(
        'A user with this email already exists',
        context.requestId
      )
    }

    // Create the user directly (without email invite)
    // Generate a temporary password - user will set their own on first login
    const tempPassword = crypto.randomUUID()

    const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
      email: validatedData.email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        full_name: validatedData.fullName,
        role: validatedData.role,
      },
    })

    if (createError) {
      console.error('Create user error:', createError)
      return apiBadRequest(createError.message, context.requestId)
    }

    // Update the profile with additional data
    if (userData.user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: profileError } = await (adminClient as any)
        .from('profiles')
        .update({
          full_name: validatedData.fullName,
          role: validatedData.role,
          store_id: validatedData.storeId || null,
          status: 'Active',
        })
        .eq('id', userData.user.id)

      if (profileError) {
        console.error('Profile update error:', profileError)
      }
    }

    return apiSuccess(
      {
        message: 'User created successfully',
        tempPassword: tempPassword,
      },
      { requestId: context.requestId, status: 201 }
    )
  } catch (error) {
    console.error('Error inviting user:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to invite user')
  }
}
