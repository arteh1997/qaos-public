import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { clientEnv, getServerEnv } from '@/lib/env'

/** Cached singleton — safe because the service role key is static per deployment. */
let cachedAdminClient: SupabaseClient<Database> | null = null

/**
 * Create (or return cached) Supabase admin client that bypasses Row-Level Security.
 *
 * Uses the `SUPABASE_SERVICE_ROLE_KEY` — this key has full database access.
 * **Only use after `withApiAuth` has verified the caller's identity and permissions.**
 *
 * The client is cached as a module-level singleton because the service role key
 * never changes at runtime, and re-creating the client per request adds overhead
 * on the hot path (every authenticated API call that needs admin access).
 *
 * Auth options disable token refresh and session persistence since the service
 * role key doesn't represent a user session.
 */
export function createAdminClient() {
  if (!cachedAdminClient) {
    const serverEnv = getServerEnv()
    cachedAdminClient = createClient<Database>(
      clientEnv.NEXT_PUBLIC_SUPABASE_URL,
      serverEnv.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  }
  return cachedAdminClient
}
