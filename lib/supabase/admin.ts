import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { clientEnv, getServerEnv } from '@/lib/env'

// Cached singleton — safe because admin client uses static credentials
let cachedAdminClient: SupabaseClient<Database> | null = null

// Admin client with service role key - bypasses RLS
// Use this ONLY for admin operations like creating users, etc.
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
