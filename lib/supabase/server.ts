import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'
import { clientEnv } from '@/lib/env'

/**
 * Create a Supabase server client for use in Server Components and API routes.
 *
 * Uses the anon key + user's session cookies, so all queries respect RLS.
 * The `setAll` callback silently catches errors when called from Server Components
 * (cookies are read-only there) — the Next.js middleware handles session refresh.
 *
 * Must be called per-request (not cached) because it reads from the cookie store.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  )
}
