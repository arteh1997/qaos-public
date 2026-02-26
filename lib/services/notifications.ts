import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, getSupplierPortalInviteEmailHtml } from '@/lib/email'
import {
  getShiftAssignedEmailHtml,
  getShiftUpdatedEmailHtml,
  getShiftCancelledEmailHtml,
  getPayslipAvailableEmailHtml,
  getPOStatusUpdateEmailHtml,
  getDeliveryReceivedEmailHtml,
  getRemovedFromStoreEmailHtml,
  getPaymentSucceededEmailHtml,
  getSubscriptionCancelledEmailHtml,
} from '@/lib/email-notifications'
import type { NotificationType, AppRole } from '@/types'
import { logger } from '@/lib/logger'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Maps notification type to the column name in notification_preferences
const PREFERENCE_COLUMN_MAP: Record<string, string> = {
  shift_assigned: 'shift_assigned',
  shift_updated: 'shift_updated',
  shift_cancelled: 'shift_cancelled',
  payslip_available: 'payslip_available',
  po_supplier_update: 'po_supplier_update',
  delivery_received: 'delivery_received',
  removed_from_store: 'removed_from_store',
}

// Types that don't have user-configurable preferences (always send)
const ALWAYS_SEND_TYPES: NotificationType[] = [
  'payment_succeeded',
  'subscription_cancelled',
  'supplier_portal_invite',
]

interface NotificationParams {
  type: NotificationType
  storeId: string
  recipientUserId: string
  data: Record<string, unknown>
  triggeredByUserId?: string
}

interface BroadcastParams {
  type: NotificationType
  storeId: string
  data: Record<string, unknown>
  triggeredByUserId?: string
  roles?: AppRole[]
}

/**
 * Send a notification email to a specific user.
 * Checks notification preferences before sending.
 * Fire-and-forget — does not throw on failure.
 */
export async function sendNotification(params: NotificationParams): Promise<void> {
  const { type, storeId, recipientUserId, data, triggeredByUserId } = params

  try {
    // Don't email yourself
    if (triggeredByUserId && triggeredByUserId === recipientUserId) return

    const supabase = createAdminClient()

    // Check notification preferences (unless it's an always-send type)
    if (!ALWAYS_SEND_TYPES.includes(type)) {
      const prefColumn = PREFERENCE_COLUMN_MAP[type]
      if (prefColumn) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: pref } = await (supabase as any)
          .from('notification_preferences')
          .select(prefColumn)
          .eq('user_id', recipientUserId)
          .eq('store_id', storeId)
          .maybeSingle()

        // If preference exists and is disabled, skip
        if (pref && pref[prefColumn] === false) return
        // If no preference record exists, defaults are all true — continue sending
      }
    }

    // Look up recipient email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', recipientUserId)
      .single()

    if (!profile?.email) return

    // Build and send email
    const email = buildEmail(type, { ...data, recipientName: profile.full_name })
    if (!email) return

    const result = await sendEmail({
      to: profile.email,
      subject: email.subject,
      html: email.html,
    })

    // Log to alert_history
    await supabase.from('alert_history').insert({
      store_id: storeId,
      user_id: recipientUserId,
      alert_type: type,
      channel: 'email',
      subject: email.subject,
      item_count: 0,
      status: result.success ? 'sent' : 'failed',
      error_message: result.error ?? null,
      metadata: { notification_data: data } as unknown as Record<string, never>,
    })
  } catch (error) {
    logger.error(`[Notifications] Failed to send ${type} notification:`, error)
  }
}

/**
 * Send a notification to all Owners/Managers at a store.
 * Useful for operational notifications like delivery received, PO updates.
 */
export async function notifyStoreManagement(params: BroadcastParams): Promise<void> {
  const { type, storeId, data, triggeredByUserId, roles = ['Owner', 'Manager'] } = params

  try {
    const supabase = createAdminClient()

    const { data: storeUsers } = await supabase
      .from('store_users')
      .select('user_id, role')
      .eq('store_id', storeId)
      .in('role', roles)

    if (!storeUsers || storeUsers.length === 0) return

    // Send to each user in parallel (fire-and-forget)
    await Promise.allSettled(
      storeUsers.map(su =>
        sendNotification({
          type,
          storeId,
          recipientUserId: su.user_id,
          data,
          triggeredByUserId,
        })
      )
    )
  } catch (error) {
    logger.error(`[Notifications] Failed to broadcast ${type}:`, error)
  }
}

/**
 * Send notification to a specific external email (e.g., supplier portal invite).
 * Bypasses preference checks.
 */
export async function sendExternalNotification(params: {
  type: NotificationType
  storeId: string
  to: string
  data: Record<string, unknown>
}): Promise<void> {
  const { type, storeId, to, data } = params

  try {
    const email = buildEmail(type, data)
    if (!email) return

    const result = await sendEmail({
      to,
      subject: email.subject,
      html: email.html,
    })

    const supabase = createAdminClient()
    await supabase.from('alert_history').insert({
      store_id: storeId,
      user_id: data.createdByUserId as string || '00000000-0000-0000-0000-000000000000',
      alert_type: type,
      channel: 'email',
      subject: email.subject,
      item_count: 0,
      status: result.success ? 'sent' : 'failed',
      error_message: result.error ?? null,
      metadata: { to, notification_data: data } as unknown as Record<string, never>,
    })
  } catch (error) {
    logger.error(`[Notifications] Failed to send external ${type} notification:`, error)
  }
}

interface EmailContent {
  subject: string
  html: string
}

function buildEmail(type: NotificationType, data: Record<string, unknown>): EmailContent | null {
  switch (type) {
    case 'shift_assigned':
      return {
        subject: `New Shift: ${data.dayOfWeek} ${data.date} at ${data.storeName}`,
        html: getShiftAssignedEmailHtml({
          recipientName: data.recipientName as string || 'Team Member',
          managerName: data.managerName as string,
          storeName: data.storeName as string,
          date: data.date as string,
          dayOfWeek: data.dayOfWeek as string,
          startTime: data.startTime as string,
          endTime: data.endTime as string,
          duration: data.duration as string,
          notes: data.notes as string | null,
          shiftsUrl: `${APP_URL}/my-shifts`,
        }),
      }

    case 'shift_updated':
      return {
        subject: `Shift Updated: ${data.dayOfWeek} ${data.date} at ${data.storeName}`,
        html: getShiftUpdatedEmailHtml({
          recipientName: data.recipientName as string || 'Team Member',
          managerName: data.managerName as string,
          storeName: data.storeName as string,
          date: data.date as string,
          dayOfWeek: data.dayOfWeek as string,
          previousStartTime: data.previousStartTime as string,
          previousEndTime: data.previousEndTime as string,
          newStartTime: data.newStartTime as string,
          newEndTime: data.newEndTime as string,
          notes: data.notes as string | null,
          shiftsUrl: `${APP_URL}/my-shifts`,
        }),
      }

    case 'shift_cancelled':
      return {
        subject: `Shift Cancelled: ${data.dayOfWeek} ${data.date} at ${data.storeName}`,
        html: getShiftCancelledEmailHtml({
          recipientName: data.recipientName as string || 'Team Member',
          managerName: data.managerName as string,
          storeName: data.storeName as string,
          date: data.date as string,
          dayOfWeek: data.dayOfWeek as string,
          startTime: data.startTime as string,
          endTime: data.endTime as string,
          shiftsUrl: `${APP_URL}/my-shifts`,
        }),
      }

    case 'payslip_available':
      return {
        subject: `Payslip Available: ${data.periodStart} – ${data.periodEnd}`,
        html: getPayslipAvailableEmailHtml({
          recipientName: data.recipientName as string || 'Team Member',
          storeName: data.storeName as string,
          periodStart: data.periodStart as string,
          periodEnd: data.periodEnd as string,
          totalHours: data.totalHours as number,
          hourlyRate: data.hourlyRate as number,
          grossPay: data.grossPay as number,
          adjustments: data.adjustments as number,
          adjustmentNotes: data.adjustmentNotes as string | null,
          netPay: data.netPay as number,
          currency: (data.currency as string) || 'GBP',
          payUrl: `${APP_URL}/my-pay`,
        }),
      }

    case 'po_supplier_update':
      return {
        subject: `PO #${data.poNumber} ${data.status}: ${data.supplierName}`,
        html: getPOStatusUpdateEmailHtml({
          recipientName: data.recipientName as string || 'Manager',
          storeName: data.storeName as string,
          poNumber: data.poNumber as string,
          supplierName: data.supplierName as string,
          status: data.status as string,
          expectedDeliveryDate: data.expectedDeliveryDate as string | null,
          itemCount: data.itemCount as number,
          totalAmount: data.totalAmount as number,
          currency: (data.currency as string) || 'GBP',
          poUrl: `${APP_URL}/suppliers`,
        }),
      }

    case 'delivery_received':
      return {
        subject: `Delivery Received: PO #${data.poNumber} at ${data.storeName}`,
        html: getDeliveryReceivedEmailHtml({
          recipientName: data.recipientName as string || 'Manager',
          storeName: data.storeName as string,
          poNumber: data.poNumber as string,
          supplierName: data.supplierName as string,
          receivedByName: data.receivedByName as string,
          itemsReceived: data.itemsReceived as number,
          totalItems: data.totalItems as number,
          totalValue: data.totalValue as number,
          currency: (data.currency as string) || 'GBP',
          deliveriesUrl: `${APP_URL}/deliveries`,
        }),
      }

    case 'removed_from_store':
      return {
        subject: `Store Access Removed: ${data.storeName}`,
        html: getRemovedFromStoreEmailHtml({
          recipientName: data.recipientName as string || 'Team Member',
          storeName: data.storeName as string,
          removedByName: data.removedByName as string,
          activeShiftsEnded: data.activeShiftsEnded as number,
          dashboardUrl: `${APP_URL}/`,
        }),
      }

    case 'payment_succeeded':
      return {
        subject: `Payment Received: ${data.storeName} — ${data.formattedAmount}`,
        html: getPaymentSucceededEmailHtml({
          storeName: data.storeName as string,
          amount: data.formattedAmount as string,
          periodLabel: data.periodLabel as string,
          billingUrl: `${APP_URL}/billing`,
        }),
      }

    case 'subscription_cancelled':
      return {
        subject: `Subscription Cancelled: ${data.storeName}`,
        html: getSubscriptionCancelledEmailHtml({
          storeName: data.storeName as string,
          accessUntil: data.accessUntil as string,
          billingUrl: `${APP_URL}/billing`,
        }),
      }

    case 'supplier_portal_invite':
      return {
        subject: `Supplier Portal Access: ${data.storeName}`,
        html: getSupplierPortalInviteEmailHtml({
          supplierName: data.supplierName as string,
          storeName: data.storeName as string,
          portalUrl: data.portalUrl as string,
          permissions: (data.permissions as string[]) || ['can_view_orders'],
        }),
      }

    default:
      return null
  }
}
