import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiNotFound,
  apiForbidden,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { shiftSchema } from '@/lib/validations/shift'
import { sanitizeNotes } from '@/lib/utils'
import { Shift } from '@/types'

interface RouteParams {
  params: Promise<{ shiftId: string }>
}

/**
 * GET /api/shifts/:shiftId - Get a single shift
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { shiftId } = await params

    const auth = await withApiAuth(request, {
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: shift, error } = await (context.supabase as any)
      .from('shifts')
      .select(`
        *,
        store:stores(*),
        user:profiles(id, full_name, email)
      `)
      .eq('id', shiftId)
      .single()

    if (error || !shift) {
      return apiNotFound('Shift', context.requestId)
    }

    // Staff can only see their own shifts
    if (context.profile.role === 'Staff' && shift.user_id !== context.user.id) {
      return apiForbidden('You can only view your own shifts', context.requestId)
    }

    return apiSuccess(shift as Shift, { requestId: context.requestId })
  } catch (error) {
    console.error('Error getting shift:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to get shift')
  }
}

/**
 * PATCH /api/shifts/:shiftId - Update a shift
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { shiftId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Admin'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth
    const body = await request.json()

    // Validate input (partial)
    const validationResult = shiftSchema.partial().safeParse(body)
    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const data = validationResult.data

    // Sanitize notes if present
    const updateData = {
      ...data,
      notes: data.notes !== undefined ? sanitizeNotes(data.notes) : undefined,
      updated_at: new Date().toISOString(),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: shift, error } = await (context.supabase as any)
      .from('shifts')
      .update(updateData)
      .eq('id', shiftId)
      .select(`
        *,
        store:stores(*),
        user:profiles(id, full_name, email)
      `)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return apiNotFound('Shift', context.requestId)
      }
      throw error
    }

    return apiSuccess(shift as Shift, { requestId: context.requestId })
  } catch (error) {
    console.error('Error updating shift:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to update shift')
  }
}

/**
 * DELETE /api/shifts/:shiftId - Delete a shift
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { shiftId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Admin'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any)
      .from('shifts')
      .delete()
      .eq('id', shiftId)

    if (error) throw error

    return apiSuccess({ deleted: true }, { requestId: context.requestId })
  } catch (error) {
    console.error('Error deleting shift:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to delete shift')
  }
}
