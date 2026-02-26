import { NextRequest } from 'next/server'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest, apiForbidden } from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { generatePortalToken } from '@/lib/services/supplier-portal'
import { createPortalTokenSchema } from '@/lib/validations/supplier-portal'
import { auditLog } from '@/lib/audit'
import { sendExternalNotification } from '@/lib/services/notifications'

/**
 * GET  /api/stores/[storeId]/suppliers/[supplierId]/portal-tokens
 * List all portal tokens for a supplier.
 *
 * POST /api/stores/[storeId]/suppliers/[supplierId]/portal-tokens
 * Generate a new portal token. Returns the plaintext token once.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; supplierId: string }> }
) {
  try {
    const { storeId, supplierId } = await params
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })
    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const supabase = createAdminClient()

    const { data: tokens, error } = await supabase
      .from('supplier_portal_tokens')
      .select('id, supplier_id, store_id, token_prefix, name, is_active, can_view_orders, can_upload_invoices, can_update_catalog, can_update_order_status, last_used_at, expires_at, created_at')
      .eq('supplier_id', supplierId)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })

    if (error) {
      return apiError('Failed to fetch portal tokens', { status: 500, requestId: context.requestId })
    }

    return apiSuccess(tokens, { requestId: context.requestId })
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'Failed to fetch portal tokens',
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; supplierId: string }> }
) {
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
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const body = await request.json()
    const parsed = createPortalTokenSchema.safeParse(body)
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message || 'Invalid request', context.requestId)
    }

    const supabase = createAdminClient()

    // Verify supplier belongs to store
    const { data: supplier, error: supplierErr } = await supabase
      .from('suppliers')
      .select('id, name, email')
      .eq('id', supplierId)
      .eq('store_id', storeId)
      .single()

    if (supplierErr || !supplier) {
      return apiBadRequest('Supplier not found in this store', context.requestId)
    }

    // Generate token
    const { token, tokenHash, tokenPrefix } = generatePortalToken()

    const { data: created, error: insertErr } = await supabase
      .from('supplier_portal_tokens')
      .insert({
        supplier_id: supplierId,
        store_id: storeId,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        name: parsed.data.name,
        can_view_orders: parsed.data.can_view_orders,
        can_upload_invoices: parsed.data.can_upload_invoices,
        can_update_catalog: parsed.data.can_update_catalog,
        can_update_order_status: parsed.data.can_update_order_status,
        expires_at: parsed.data.expires_at || null,
        created_by: context.user.id,
      })
      .select('id, token_prefix, name, is_active, can_view_orders, can_upload_invoices, can_update_catalog, can_update_order_status, expires_at, created_at')
      .single()

    if (insertErr) {
      return apiError('Failed to create portal token', { status: 500, requestId: context.requestId })
    }

    await auditLog(supabase, {
      userId: context.user.id,
      storeId,
      action: 'supplier_portal.token_created',
      details: { supplierId, supplierName: supplier.name, tokenName: parsed.data.name },
    })

    // Send supplier portal invite email if supplier has an email address
    if (supplier.email) {
      const { data: storeInfo } = await supabase
        .from('stores')
        .select('name')
        .eq('id', storeId)
        .single()

      const permissions = [
        parsed.data.can_view_orders && 'can_view_orders',
        parsed.data.can_upload_invoices && 'can_upload_invoices',
        parsed.data.can_update_catalog && 'can_update_catalog',
        parsed.data.can_update_order_status && 'can_update_order_status',
      ].filter(Boolean) as string[]

      sendExternalNotification({
        type: 'supplier_portal_invite',
        storeId,
        to: supplier.email,
        data: {
          supplierName: supplier.name,
          storeName: storeInfo?.name || 'a restaurant',
          portalUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/supplier-portal`,
          permissions,
          createdByUserId: context.user.id,
        },
      }).catch(() => {})
    }

    // Return the plaintext token (only time it's visible)
    return apiSuccess(
      { ...created, token },
      { requestId: context.requestId, status: 201 }
    )
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'Failed to create portal token',
      { status: 500 }
    )
  }
}
