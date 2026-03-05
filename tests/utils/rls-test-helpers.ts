/**
 * RLS Testing Utilities
 *
 * These helpers create REAL authenticated Supabase clients to test
 * Row Level Security policies at the database level.
 */

import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AppRole } from '@/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials for RLS tests')
}

// Admin client for test setup/cleanup
export const adminClient = createAdminClient()

/**
 * Test user credentials
 */
export interface TestUserCredentials {
  id: string
  email: string
  password: string
  role: AppRole
}

/**
 * Test store data
 */
export interface TestStore {
  id: string
  name: string
  is_active: boolean
}

/**
 * Create a test user with profile and store membership
 */
export async function createTestUser(options: {
  email: string
  password: string
  role: AppRole
  storeId?: string
  fullName?: string
  isPlatformAdmin?: boolean
  cleanupFirst?: boolean
}): Promise<TestUserCredentials> {
  const { email, password, role, storeId, fullName, isPlatformAdmin = false, cleanupFirst = false } = options

  // Optionally clean up existing user with same email (from failed previous test runs)
  // NOTE: This calls listUsers() which can hit rate limits if called too frequently
  if (cleanupFirst) {
    await deleteTestUserByEmail(email)
  }

  // Create auth user
   
  const adminAny = adminClient as any
  const { data: authData, error: authError } = await adminAny.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    throw new Error(`Failed to create test user: ${authError.message}`)
  }

  // Create profile
  const { error: profileError } = await adminAny
    .from('profiles')
    .upsert({
      id: authData.user.id,
      email,
      full_name: fullName || email.split('@')[0],
      role,
      status: 'Active',
      is_platform_admin: isPlatformAdmin,
    })

  if (profileError) {
    throw new Error(`Failed to create profile: ${profileError.message}`)
  }

  // Create store membership if storeId provided
  if (storeId) {
    const { error: membershipError } = await adminAny
      .from('store_users')
      .insert({
        store_id: storeId,
        user_id: authData.user.id,
        role,
        is_billing_owner: role === 'Owner',
      })

    if (membershipError) {
      throw new Error(`Failed to create store membership: ${membershipError.message}`)
    }
  }

  return {
    id: authData.user.id,
    email,
    password,
    role,
  }
}

/**
 * Create a test store
 */
export async function createTestStore(options: {
  name: string
  billingUserId?: string
  subscriptionStatus?: string
}): Promise<TestStore> {
  const {
    name,
    billingUserId = null,
    subscriptionStatus = 'active',
  } = options

   
  const adminAny = adminClient as any
  const { data, error } = await adminAny
    .from('stores')
    .insert({
      name,
      billing_user_id: billingUserId,
      subscription_status: subscriptionStatus,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create test store: ${error.message}`)
  }

  return {
    id: data.id,
    name: data.name,
    is_active: data.is_active,
  }
}

// Cache for authenticated clients to avoid hitting rate limits
const clientCache = new Map<string, { client: any; timestamp: number }>()
const CACHE_TTL = 30000 // 30 seconds
let lastAuthTime = 0
const MIN_AUTH_DELAY = 100 // Minimum 100ms between auth requests

/**
 * Create an authenticated Supabase client for a specific user
 * Uses caching to avoid rate limits
 */
export async function createAuthenticatedClient(
  credentials: TestUserCredentials
) {
  // Check cache first
  const cacheKey = credentials.email
  const cached = clientCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.client
  }

  // Rate limit protection: ensure minimum delay between auth requests
  const now = Date.now()
  const timeSinceLastAuth = now - lastAuthTime
  if (timeSinceLastAuth < MIN_AUTH_DELAY) {
    await new Promise(resolve => setTimeout(resolve, MIN_AUTH_DELAY - timeSinceLastAuth))
  }
  lastAuthTime = Date.now()

  // IMPORTANT: Use anon key (not service role) so RLS policies are enforced
  // Signing in with service role creates a JWT with elevated permissions
  // even if we later use it with anon key client
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Sign in as the test user (using anon key client)
  const { error } = await client.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  })

  if (error) {
    throw new Error(`Failed to authenticate test user: ${error.message}`)
  }

  // Client already has the authenticated session
  // No need to create a new client - just cache and return this one
  clientCache.set(cacheKey, {
    client,
    timestamp: Date.now(),
  })

  return client
}

/**
 * Delete a test user and all associated data
 */
export async function deleteTestUser(userId: string) {
   
  const adminAny = adminClient as any

  // Delete store memberships
  await adminAny.from('store_users').delete().eq('user_id', userId)

  // Delete profile
  await adminAny.from('profiles').delete().eq('id', userId)

  // Delete auth user
  await adminAny.auth.admin.deleteUser(userId)
}

/**
 * Delete a test user by email (useful for cleanup of failed test runs)
 */
export async function deleteTestUserByEmail(email: string) {
   
  const adminAny = adminClient as any

  // Find user by email
  const { data: users } = await adminAny.auth.admin.listUsers()
  const user = users?.users?.find((u: { email: string }) => u.email === email)

  if (user) {
    await deleteTestUser(user.id)
  }
}

/**
 * Delete a test store and all associated data
 */
export async function deleteTestStore(storeId: string) {
   
  const adminAny = adminClient as any

  // CASCADE will handle most relationships, but clean up explicitly
  await adminAny.from('store_users').delete().eq('store_id', storeId)
  await adminAny.from('store_inventory').delete().eq('store_id', storeId)
  await adminAny.from('inventory_items').delete().eq('store_id', storeId)
  await adminAny.from('shifts').delete().eq('store_id', storeId)
  await adminAny.from('stores').delete().eq('id', storeId)
}

/**
 * Create test inventory item
 */
export async function createTestInventoryItem(options: {
  storeId: string
  name: string
  category?: string
  unitOfMeasure?: string
}) {
  const {
    storeId,
    name,
    category = 'Test Category',
    unitOfMeasure = 'kg',
  } = options

   
  const adminAny = adminClient as any
  const { data, error } = await adminAny
    .from('inventory_items')
    .insert({
      store_id: storeId,
      name,
      category,
      unit_of_measure: unitOfMeasure,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create inventory item: ${error.message}`)
  }

  return data
}

/**
 * Create test shift
 */
export async function createTestShift(options: {
  storeId: string
  userId: string
  date?: string
  startTime?: string
  endTime?: string
}) {
  const {
    storeId,
    userId,
    date = new Date().toISOString().split('T')[0],
    startTime = '09:00:00',
    endTime = '17:00:00',
  } = options

  // Combine date and time into full ISO timestamps
  const startTimestamp = `${date}T${startTime}`
  const endTimestamp = `${date}T${endTime}`

   
  const adminAny = adminClient as any
  const { data, error } = await adminAny
    .from('shifts')
    .insert({
      store_id: storeId,
      user_id: userId,
      start_time: startTimestamp,
      end_time: endTimestamp,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create shift: ${error.message}`)
  }

  return data
}

/**
 * Clean up all test data (use sparingly - clears entire test database)
 */
export async function cleanupAllTestData() {
   
  const adminAny = adminClient as any

  // Get all test users (those with test emails)
  const { data: profiles } = await adminAny
    .from('profiles')
    .select('id')
    .ilike('email', '%test%')

  if (profiles) {
    for (const profile of profiles) {
      await deleteTestUser(profile.id)
    }
  }

  // Get all test stores
  const { data: stores } = await adminAny
    .from('stores')
    .select('id')
    .ilike('name', '%Test%')

  if (stores) {
    for (const store of stores) {
      await deleteTestStore(store.id)
    }
  }
}
