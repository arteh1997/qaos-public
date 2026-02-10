import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { RATE_LIMITS } from '@/lib/rate-limit'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
} from '@/lib/api/response'
import { createTagSchema } from '@/lib/validations/categories-tags'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * GET /api/stores/:storeId/tags
 * List all tags for a store
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager', 'Staff', 'Driver'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: false, // GET requests don't need CSRF
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // Verify user has access to this store
    const { data: storeAccess } = await context.supabase
      .from('store_users')
      .select('id')
      .eq('store_id', storeId)
      .eq('user_id', context.user.id)
      .single()

    if (!storeAccess) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    // Fetch tags with usage counts
    const { data: tags, error } = await context.supabase
      .from('item_tags')
      .select(`
        id,
        name,
        description,
        color,
        created_at
      `)
      .eq('store_id', storeId)
      .order('name', { ascending: true })

    if (error) {
      throw error
    }

    // Get usage count for each tag
    const { data: tagUsage } = await context.supabase
      .from('inventory_item_tags')
      .select('tag_id')

    const usageMap = new Map<string, number>()
    tagUsage?.forEach((item) => {
      usageMap.set(item.tag_id, (usageMap.get(item.tag_id) || 0) + 1)
    })

    const tagsWithCounts = tags?.map((tag) => ({
      ...tag,
      usage_count: usageMap.get(tag.id) || 0,
    }))

    return apiSuccess(
      { tags: tagsWithCounts || [] },
      { requestId: context.requestId }
    )
  } catch (error) {
    console.error('Error fetching tags:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to fetch tags')
  }
}

/**
 * POST /api/stores/:storeId/tags
 * Create a new tag
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // Verify user has access to this store
    const { data: storeAccess } = await context.supabase
      .from('store_users')
      .select('role')
      .eq('store_id', storeId)
      .eq('user_id', context.user.id)
      .single()

    if (!storeAccess) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    if (!['Owner', 'Manager'].includes(storeAccess.role)) {
      return apiForbidden('Only Owners and Managers can create tags', context.requestId)
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = createTagSchema.safeParse(body)

    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map((e) => e.message).join(', '),
        context.requestId
      )
    }

    const { name, description, color } = validationResult.data

    // Check for duplicate name
    const { data: existing } = await context.supabase
      .from('item_tags')
      .select('id')
      .eq('store_id', storeId)
      .eq('name', name)
      .single()

    if (existing) {
      return apiBadRequest('A tag with this name already exists', context.requestId)
    }

    // Create the tag
    const { data: tag, error } = await context.supabase
      .from('item_tags')
      .insert({
        store_id: storeId,
        name,
        description: description || null,
        color: color || null,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return apiSuccess(
      {
        message: 'Tag created successfully',
        tag,
      },
      { requestId: context.requestId, status: 201 }
    )
  } catch (error) {
    console.error('Error creating tag:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to create tag')
  }
}
