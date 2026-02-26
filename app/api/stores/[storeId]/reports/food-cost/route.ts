import { NextRequest } from 'next/server'
import { withApiAuth, canAccessStore } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest, apiForbidden } from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { generateFoodCostReport } from '@/lib/services/food-cost'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * GET /api/stores/:storeId/reports/food-cost
 *
 * Actual vs Theoretical food cost analysis.
 * Requires Owner or Manager role.
 *
 * Query params:
 *   - startDate (required): YYYY-MM-DD
 *   - endDate (required): YYYY-MM-DD
 *   - categoryId (optional): filter by menu item category
 *   - menuItemId (optional): filter to single menu item
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'reports', config: RATE_LIMITS.reports },
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canAccessStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return apiBadRequest('startDate and endDate query parameters are required (YYYY-MM-DD)', context.requestId)
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return apiBadRequest('Dates must be in YYYY-MM-DD format', context.requestId)
    }

    if (startDate > endDate) {
      return apiBadRequest('startDate must be before or equal to endDate', context.requestId)
    }

    const categoryId = searchParams.get('categoryId') || undefined
    const menuItemId = searchParams.get('menuItemId') || undefined

    const report = await generateFoodCostReport(context.supabase, {
      storeId,
      startDate,
      endDate,
      categoryId,
      menuItemId,
    })

    return apiSuccess(report, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error generating food cost report:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to generate food cost report')
  }
}
