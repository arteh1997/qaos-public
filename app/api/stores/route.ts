import { NextRequest } from 'next/server'
import { withApiAuth, parsePaginationParams, parseFilterParams } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  createPaginationMeta,
  sanitizeSearchQuery,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { storeSchema } from '@/lib/validations/store'
import { createAdminClient } from '@/lib/supabase/admin'
import { Store } from '@/types'

/**
 * GET /api/stores - List all stores with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withApiAuth(request, {
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth
    const { page, pageSize, from, to } = parsePaginationParams(request)
    const { search, status } = parseFilterParams(request)

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (context.supabase as any)
      .from('stores')
      .select('*', { count: 'exact' })

    // Apply search filter (sanitized to prevent query manipulation)
    if (search) {
      const sanitizedSearch = sanitizeSearchQuery(search)
      if (sanitizedSearch) {
        query = query.or(`name.ilike.%${sanitizedSearch}%,address.ilike.%${sanitizedSearch}%`)
      }
    }

    // Apply status filter
    if (status === 'active') {
      query = query.eq('is_active', true)
    } else if (status === 'inactive') {
      query = query.eq('is_active', false)
    }

    // For Staff, only show their store
    if (context.profile.role === 'Staff' && context.profile.store_id) {
      query = query.eq('id', context.profile.store_id)
    }

    const { data, error, count } = await query
      .order('name')
      .range(from, to)

    if (error) throw error

    const stores = data as Store[]
    const totalItems = count ?? 0

    return apiSuccess(stores, {
      requestId: context.requestId,
      pagination: createPaginationMeta(page, pageSize, totalItems),
    })
  } catch (error) {
    console.error('Error listing stores:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to list stores')
  }
}

/**
 * POST /api/stores - Create a new store
 *
 * Two scenarios:
 * 1. New user (onboarding) - no stores yet, creating their first store
 * 2. Existing Owner - adding another store to their account
 */
export async function POST(request: NextRequest) {
  try {
    // Allow authenticated users (for onboarding) or Owners (for adding stores)
    const auth = await withApiAuth(request, {
      // Don't restrict roles - we'll check manually for onboarding flow
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth
    const body = await request.json()

    // Check if this is an onboarding scenario (user has no stores)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingMemberships } = await (context.supabase as any)
      .from('store_users')
      .select('id')
      .eq('user_id', context.user.id)
      .limit(1)

    const isOnboarding = !existingMemberships || existingMemberships.length === 0
    const isOwner = context.profile?.role === 'Owner' ||
      existingMemberships?.some((m: { role?: string }) => m.role === 'Owner')

    // Only allow if onboarding or if user is already an Owner
    if (!isOnboarding && !isOwner) {
      return apiBadRequest('Only Owners can create new stores', context.requestId)
    }

    // Validate input
    const validationResult = storeSchema.safeParse(body)
    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    // Create the store with billing_user_id set to current user
    const storeData = {
      ...validationResult.data,
      billing_user_id: context.user.id,
    }

    // Use admin client to bypass RLS for this trusted server operation
    // We've already verified the user's identity and permissions above
    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminAny = adminClient as any

    const { data: store, error: storeError } = await adminAny
      .from('stores')
      .insert(storeData)
      .select()
      .single()

    if (storeError) throw storeError

    // Add the user as Owner of this store in store_users
    const { error: membershipError } = await adminAny
      .from('store_users')
      .insert({
        store_id: store.id,
        user_id: context.user.id,
        role: 'Owner',
        is_billing_owner: true,
      })

    if (membershipError) {
      // Rollback: delete the store if we couldn't create the membership
      await adminAny.from('stores').delete().eq('id', store.id)
      throw membershipError
    }

    // If this is onboarding (first store), update the profile's default_store_id
    if (isOnboarding) {
      await adminAny
        .from('profiles')
        .update({
          default_store_id: store.id,
          role: 'Owner', // Update legacy role field
        })
        .eq('id', context.user.id)
    }

    return apiSuccess(store as Store, {
      requestId: context.requestId,
      status: 201,
    })
  } catch (error) {
    console.error('Error creating store:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to create store')
  }
}
