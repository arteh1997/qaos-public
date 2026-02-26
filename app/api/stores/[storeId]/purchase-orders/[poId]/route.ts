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
import { updatePurchaseOrderSchema } from '@/lib/validations/suppliers'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog, computeFieldChanges } from '@/lib/audit'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string; poId: string }>
}

// Valid status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ['awaiting_delivery', 'cancelled'],
  awaiting_delivery: ['partial', 'received', 'cancelled'],
  partial: ['received', 'cancelled'],
  received: [],
  cancelled: [],
}

/**
 * GET /api/stores/:storeId/purchase-orders/:poId - Get PO detail
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, poId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canAccessStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const { data: po, error } = await context.supabase
      .from('purchase_orders')
      .select('*, supplier:suppliers(id, name, email, phone, contact_person)')
      .eq('id', poId)
      .eq('store_id', storeId)
      .single()

    if (error || !po) {
      return apiNotFound('Purchase order', context.requestId)
    }

    // Fetch line items with inventory details
    const { data: items } = await context.supabase
      .from('purchase_order_items')
      .select('*, inventory_item:inventory_items(id, name, category, unit_of_measure)')
      .eq('purchase_order_id', poId)
      .order('created_at', { ascending: true })

    return apiSuccess(
      { ...po, items: items || [] },
      { requestId: context.requestId }
    )
  } catch (error) {
    logger.error('Error fetching purchase order:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to fetch purchase order')
  }
}

/**
 * PUT /api/stores/:storeId/purchase-orders/:poId - Update PO (status, dates, notes)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, poId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to update purchase orders', context.requestId)
    }

    const body = await request.json()
    const validation = updatePurchaseOrderSchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    // Fetch current state (used for both status validation and before/after tracking)
    const { data: beforePO } = await context.supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', poId)
      .eq('store_id', storeId)
      .single()

    // If status transition, validate it
    if (validation.data.status) {
      if (!beforePO) {
        return apiNotFound('Purchase order', context.requestId)
      }

      const allowedTransitions = STATUS_TRANSITIONS[beforePO.status] || []
      if (!allowedTransitions.includes(validation.data.status)) {
        return apiBadRequest(
          `Cannot transition from '${beforePO.status}' to '${validation.data.status}'. Allowed: ${allowedTransitions.join(', ') || 'none'}`,
          context.requestId
        )
      }
    }

    const updateData: Record<string, unknown> = { ...validation.data }
    if (updateData.notes === '') updateData.notes = null

    // Set actual_delivery_date when receiving
    if (validation.data.status === 'received') {
      updateData.actual_delivery_date = new Date().toISOString().split('T')[0]
    }

    const { data, error } = await context.supabase
      .from('purchase_orders')
      .update(updateData)
      .eq('id', poId)
      .eq('store_id', storeId)
      .select('*, supplier:suppliers(id, name)')
      .single()

    if (error || !data) {
      return apiNotFound('Purchase order', context.requestId)
    }

    // Audit log
    const admin = createAdminClient()
    const fieldChanges = beforePO
      ? computeFieldChanges(beforePO, updateData)
      : []
    void auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'purchase_order.update',
      storeId,
      resourceType: 'purchase_order',
      resourceId: poId,
      details: {
        poNumber: data.po_number,
        status: data.status,
        updatedFields: Object.keys(validation.data),
        fieldChanges,
      },
      request,
    }).catch(err => logger.error('Audit log error:', { error: err }))

    return apiSuccess(data, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error updating purchase order:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to update purchase order')
  }
}

/**
 * DELETE /api/stores/:storeId/purchase-orders/:poId - Delete an open PO
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, poId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to delete purchase orders', context.requestId)
    }

    // Only open POs can be deleted
    const { data: po } = await context.supabase
      .from('purchase_orders')
      .select('status, po_number')
      .eq('id', poId)
      .eq('store_id', storeId)
      .single()

    if (!po) {
      return apiNotFound('Purchase order', context.requestId)
    }

    if (po.status !== 'open') {
      return apiBadRequest(
        'Only open purchase orders can be deleted. Cancel non-open orders instead.',
        context.requestId
      )
    }

    const { error } = await context.supabase
      .from('purchase_orders')
      .delete()
      .eq('id', poId)
      .eq('store_id', storeId)

    if (error) {
      return apiError('Failed to delete purchase order')
    }

    // Audit log
    const adminDelete = createAdminClient()
    await auditLog(adminDelete, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'purchase_order.delete',
      storeId,
      resourceType: 'purchase_order',
      resourceId: poId,
      details: { poNumber: po.po_number },
      request,
    })

    return apiSuccess({ message: 'Purchase order deleted successfully' }, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error deleting purchase order:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to delete purchase order')
  }
}
