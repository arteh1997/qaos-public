import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { clientEnv } from '@/lib/env'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')

  if (!code) {
    logger.error('OAuth callback missing code parameter')
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
  }

  // Build redirect response first so we can set cookies on it
  const redirectTo = new URL('/', origin)
  const response = NextResponse.redirect(redirectTo)

  // Create a Supabase client that reads/writes cookies on the response
  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Exchange the code for a session
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    logger.error('OAuth code exchange failed', { error })
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
  }

  const user = data.session.user

  // Ensure a profile row exists (Google OAuth users won't have one on first sign-in)
  try {
    const adminClient = createAdminClient()
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!existingProfile) {
      const fullName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'User'

      await adminClient.from('profiles').upsert(
        {
          id: user.id,
          email: user.email!.toLowerCase(),
          full_name: fullName,
          role: 'Owner',
          status: 'Active',
        },
        { onConflict: 'id' }
      )
    }
  } catch (profileError) {
    // Log but don't block — the user has a valid session.
    // AuthProvider will handle missing profile gracefully.
    logger.error('Failed to ensure profile for OAuth user', { error: profileError, userId: user.id })
  }

  return response
}
