import { NextRequest } from 'next/server'
import { withApiAuth, canAccessStore, canManageStore } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
  apiNotFound,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { updateSupplierSchema } from '@/lib/validations/suppliers'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog, computeFieldChanges } from '@/lib/audit'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string; supplierId: string }>
}

/**
 * GET /api/stores/:storeId/suppliers/:supplierId - Get supplier detail
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, supplierId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canAccessStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const { data, error } = await context.supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .eq('store_id', storeId)
      .single()

    if (error || !data) {
      return apiNotFound('Supplier', context.requestId)
    }

    // Fetch supplier items with inventory details
    const { data: items } = await context.supabase
      .from('supplier_items')
      .select('*, inventory_item:inventory_items(id, name, category, unit_of_measure)')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })

    // Fetch recent purchase orders
    const { data: orders } = await context.supabase
      .from('purchase_orders')
      .select('id, po_number, status, order_date, total_amount, currency')
      .eq('supplier_id', supplierId)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(10)

    return apiSuccess({
      ...data,
      items: items || [],
      recent_orders: orders || [],
    }, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error fetching supplier:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to fetch supplier')
  }
}

/**
 * PUT /api/stores/:storeId/suppliers/:supplierId - Update supplier
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, supplierId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to update suppliers', context.requestId)
    }

    const body = await request.json()
    const validation = updateSupplierSchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    // Clean empty strings to null
    const cleanData: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(validation.data)) {
      cleanData[k] = v === '' ? null : v
    }

    // Fetch current state for before/after tracking
    const { data: beforeSupplier } = await context.supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .eq('store_id', storeId)
      .single()

    const { data, error } = await context.supabase
      .from('suppliers')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(cleanData as any)
      .eq('id', supplierId)
      .eq('store_id', storeId)
      .select()
      .single()

    if (error || !data) {
      if (error?.code === '23505') {
        return apiBadRequest('A supplier with this name already exists', context.requestId)
      }
      return apiNotFound('Supplier', context.requestId)
    }

    // Audit log
    const admin = createAdminClient()
    const fieldChanges = beforeSupplier
      ? computeFieldChanges(beforeSupplier, cleanData)
      : []
    void auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'supplier.update',
      storeId,
      resourceType: 'supplier',
      resourceId: supplierId,
      details: { supplierName: data.name, updatedFields: Object.keys(cleanData), fieldChanges },
      request,
    }).catch(err => logger.error('Audit log error:', { error: err }))

    return apiSuccess(data, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error updating supplier:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to update supplier')
  }
}

/**
 * DELETE /api/stores/:storeId/suppliers/:supplierId - Delete supplier
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, supplierId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to delete suppliers', context.requestId)
    }

    // Check for active purchase orders
    const { data: activePOs } = await context.supabase
      .from('purchase_orders')
      .select('id')
      .eq('supplier_id', supplierId)
      .in('status', ['submitted', 'acknowledged', 'shipped', 'partial'])
      .limit(1)

    if (activePOs && activePOs.length > 0) {
      return apiBadRequest(
        'Cannot delete supplier with active purchase orders. Cancel or complete them first.',
        context.requestId
      )
    }

    const { error } = await context.supabase
      .from('suppliers')
      .delete()
      .eq('id', supplierId)
      .eq('store_id', storeId)

    if (error) {
      return apiError('Failed to delete supplier')
    }

    // Audit log
    const admin = createAdminClient()
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'supplier.delete',
      storeId,
      resourceType: 'supplier',
      resourceId: supplierId,
      details: {},
      request,
    })

    return apiSuccess({ message: 'Supplier deleted successfully' }, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error deleting supplier:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to delete supplier')
  }
}
