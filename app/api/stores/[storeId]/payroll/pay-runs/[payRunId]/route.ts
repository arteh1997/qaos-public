import { NextRequest } from 'next/server'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
  apiNotFound,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { updatePayRunSchema } from '@/lib/validations/payroll'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import { sendNotification } from '@/lib/services/notifications'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string; payRunId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, payRunId } = await params
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager', 'Staff'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })
    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const { data: payRun, error } = await context.supabase
      .from('pay_runs')
      .select(`
        *,
        items:pay_run_items(
          id, user_id, hourly_rate, total_hours, overtime_hours,
          adjustments, adjustment_notes, gross_pay, shift_ids,
          user:profiles(id, full_name, email)
        ),
        creator:profiles!pay_runs_created_by_fkey(id, full_name),
        approver:profiles!pay_runs_approved_by_fkey(id, full_name)
      `)
      .eq('id', payRunId)
      .eq('store_id', storeId)
      .single()

    if (error || !payRun) {
      return apiNotFound('Pay run', context.requestId)
    }

    // Staff can only see their own items in paid pay runs
    const { data: storeUserRecord } = await context.supabase
      .from('store_users')
      .select('role')
      .eq('store_id', storeId)
      .eq('user_id', context.user.id)
      .single()

    if (storeUserRecord?.role === 'Staff') {
      if (payRun.status !== 'paid') {
        return apiNotFound('Pay run', context.requestId)
      }
      payRun.items = (payRun.items ?? []).filter(
        (item: { user_id: string }) => item.user_id === context.user.id
      )
    }

    return apiSuccess(payRun, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error fetching pay run:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to fetch pay run')
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, payRunId } = await params
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })
    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to update pay runs', context.requestId)
    }

    const { data: payRun } = await context.supabase
      .from('pay_runs')
      .select('id, status, period_start, period_end, total_amount')
      .eq('id', payRunId)
      .eq('store_id', storeId)
      .single()

    if (!payRun) {
      return apiNotFound('Pay run', context.requestId)
    }

    const body = await request.json()
    const validation = updatePayRunSchema.safeParse(body)
    if (!validation.success) {
      return apiBadRequest(validation.error.issues.map(e => e.message).join(', '), context.requestId)
    }

    const { status, notes, items } = validation.data
    const admin = createAdminClient()

    // Handle item adjustments (only on draft pay runs)
    if (items && items.length > 0) {
      if (payRun.status !== 'draft') {
        return apiBadRequest('Cannot modify items on a non-draft pay run', context.requestId)
      }

      for (const item of items) {
        if (item.adjustments !== undefined) {
          // Get current item to recalculate gross_pay
          const { data: currentItem } = await context.supabase
            .from('pay_run_items')
            .select('id, hourly_rate, total_hours, adjustments')
            .eq('pay_run_id', payRunId)
            .eq('user_id', item.user_id)
            .single()

          if (currentItem) {
            const newGrossPay = Math.round(
              (currentItem.total_hours * currentItem.hourly_rate + item.adjustments) * 100
            ) / 100

            await context.supabase
              .from('pay_run_items')
              .update({
                adjustments: item.adjustments,
                adjustment_notes: item.adjustment_notes ?? null,
                gross_pay: newGrossPay,
              })
              .eq('id', currentItem.id)

            await auditLog(admin, {
              userId: context.user.id,
              userEmail: context.user.email,
              action: 'payroll.adjustment',
              storeId,
              resourceType: 'pay_run_item',
              resourceId: currentItem.id,
              details: {
                payRunId,
                employeeId: item.user_id,
                previousAdjustment: currentItem.adjustments,
                newAdjustment: item.adjustments,
                notes: item.adjustment_notes,
              },
              request,
            })
          }
        }
      }

      // Recalculate total
      const { data: allItems } = await context.supabase
        .from('pay_run_items')
        .select('gross_pay')
        .eq('pay_run_id', payRunId)

      const newTotal = Math.round(
        (allItems ?? []).reduce((sum, i) => sum + (i.gross_pay ?? 0), 0) * 100
      ) / 100

      await context.supabase
        .from('pay_runs')
        .update({ total_amount: newTotal })
        .eq('id', payRunId)
    }

    // Handle status transitions
    if (status) {
      const validTransitions: Record<string, string[]> = {
        draft: ['approved'],
        approved: ['paid'],
      }

      if (!validTransitions[payRun.status]?.includes(status)) {
        return apiBadRequest(
          `Cannot transition from '${payRun.status}' to '${status}'`,
          context.requestId
        )
      }

      const updateData: Record<string, unknown> = { status }
      if (status === 'approved') {
        updateData.approved_by = context.user.id
        updateData.approved_at = new Date().toISOString()
      } else if (status === 'paid') {
        updateData.paid_by = context.user.id
        updateData.paid_at = new Date().toISOString()
      }

      if (notes !== undefined) {
        updateData.notes = notes
      }

      await context.supabase
        .from('pay_runs')
        .update(updateData)
        .eq('id', payRunId)

      const actionMap: Record<string, string> = {
        approved: 'payroll.pay_run_approve',
        paid: 'payroll.pay_run_paid',
      }

      await auditLog(admin, {
        userId: context.user.id,
        userEmail: context.user.email,
        action: actionMap[status],
        storeId,
        resourceType: 'pay_run',
        resourceId: payRunId,
        details: {
          periodStart: payRun.period_start,
          periodEnd: payRun.period_end,
          totalAmount: payRun.total_amount,
          previousStatus: payRun.status,
          newStatus: status,
        },
        request,
      })
    } else if (notes !== undefined && !items) {
      // Just updating notes
      await context.supabase
        .from('pay_runs')
        .update({ notes })
        .eq('id', payRunId)
    }

    // Send payslip emails when pay run is marked as paid (fire-and-forget)
    if (status === 'paid') {
      const { data: payRunItems } = await context.supabase
        .from('pay_run_items')
        .select('user_id, hourly_rate, total_hours, adjustments, adjustment_notes, gross_pay')
        .eq('pay_run_id', payRunId)

      // Get store name
      const { data: store } = await context.supabase
        .from('stores')
        .select('name')
        .eq('id', storeId)
        .single()

      const periodStart = new Date(payRun.period_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      const periodEnd = new Date(payRun.period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

      if (payRunItems) {
        for (const item of payRunItems) {
          sendNotification({
            type: 'payslip_available',
            storeId,
            recipientUserId: item.user_id,
            triggeredByUserId: context.user.id,
            data: {
              storeName: store?.name || 'your store',
              periodStart,
              periodEnd,
              totalHours: item.total_hours,
              hourlyRate: item.hourly_rate,
              grossPay: item.gross_pay,
              adjustments: item.adjustments,
              adjustmentNotes: item.adjustment_notes,
              netPay: item.gross_pay,
              currency: 'GBP',
            },
          }).catch(() => {})
        }
      }
    }

    // Fetch updated pay run
    const { data: updated } = await context.supabase
      .from('pay_runs')
      .select('*')
      .eq('id', payRunId)
      .single()

    return apiSuccess(updated, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error updating pay run:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to update pay run')
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, payRunId } = await params
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })
    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to delete pay runs', context.requestId)
    }

    const { data: payRun } = await context.supabase
      .from('pay_runs')
      .select('id, status, period_start, period_end, total_amount')
      .eq('id', payRunId)
      .eq('store_id', storeId)
      .single()

    if (!payRun) {
      return apiNotFound('Pay run', context.requestId)
    }

    if (payRun.status !== 'draft') {
      return apiBadRequest('Only draft pay runs can be deleted', context.requestId)
    }

    const { error } = await context.supabase
      .from('pay_runs')
      .delete()
      .eq('id', payRunId)

    if (error) throw error

    const admin = createAdminClient()
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'payroll.pay_run_delete',
      storeId,
      resourceType: 'pay_run',
      resourceId: payRunId,
      details: {
        periodStart: payRun.period_start,
        periodEnd: payRun.period_end,
        totalAmount: payRun.total_amount,
      },
      request,
    })

    return apiSuccess({ deleted: true }, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error deleting pay run:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to delete pay run')
  }
}
