/**
 * Billing Event Handlers Service
 *
 * Shared logic for Stripe webhook event processing.
 * Eliminates duplication in dispute handling and subscription lookups.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe/config'
import { logBillingEvent } from '@/lib/stripe/server'
import { sendDisputeNotificationEmail } from '@/lib/email'
import { debugError, debugLog } from '@/lib/debug'

// Type for subscription query result
interface DbSubscriptionRow {
  store_id: string
  billing_user_id: string
}

/**
 * Get subscription from invoice ID
 * Shared by invoice.payment_succeeded and invoice.payment_failed handlers
 */
export async function getSubscriptionFromInvoice(
  supabaseAdmin: SupabaseClient,
  subscriptionId: string
): Promise<DbSubscriptionRow | null> {
  const { data: dbSubData } = await supabaseAdmin
    .from('subscriptions')
    .select('store_id, billing_user_id')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  return dbSubData as DbSubscriptionRow | null
}

/**
 * Get subscription info from a dispute object
 * Follows chain: dispute → charge → invoice → subscription → DB subscription
 */
export async function getSubscriptionFromDispute(
  supabaseAdmin: SupabaseClient,
  dispute: Stripe.Dispute
): Promise<DbSubscriptionRow | null> {
  // Extract charge ID
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id

  // Get the charge to find the invoice/subscription
  const charge = await stripe.charges.retrieve(chargeId)
  const invoiceId = charge.invoice as string | null

  if (!invoiceId) return null

  // Get invoice to find subscription
  const invoice = await stripe.invoices.retrieve(invoiceId)
  const subscriptionId = invoice.subscription as string | null

  if (!subscriptionId) return null

  // Get DB subscription record
  return getSubscriptionFromInvoice(supabaseAdmin, subscriptionId)
}

/**
 * Handle all dispute events (created, updated, closed)
 * Eliminates 85% code duplication across 3 handlers
 */
export async function handleDisputeEvent(
  supabaseAdmin: SupabaseClient,
  dispute: Stripe.Dispute,
  eventType: 'dispute.created' | 'dispute.updated' | 'dispute.closed',
  stripeEventId: string
): Promise<void> {
  const dbSubscription = await getSubscriptionFromDispute(supabaseAdmin, dispute)

  if (!dbSubscription) {
    debugLog('Webhook', `No subscription found for dispute ${dispute.id}`)
    return
  }

  // Log billing event
  await logBillingEvent(eventType, dbSubscription.store_id, dbSubscription.billing_user_id, {
    stripeEventId,
    amountCents: dispute.amount,
    currency: dispute.currency,
    status: dispute.status,
    metadata: {
      dispute_id: dispute.id,
      charge_id: typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id,
      reason: dispute.reason,
      // Only created/updated events have evidence due date
      ...(eventType !== 'dispute.closed' && dispute.evidence_details?.due_by
        ? {
            evidence_due_by: new Date(dispute.evidence_details.due_by * 1000).toISOString(),
          }
        : {}),
    },
  })

  // Send email notification to billing owner
  const evidenceDueDate =
    eventType !== 'dispute.closed' && dispute.evidence_details?.due_by
      ? new Date(dispute.evidence_details.due_by * 1000)
      : undefined

  const emailResult = await sendDisputeNotificationEmail({
    storeId: dbSubscription.store_id,
    disputeAmount: dispute.amount,
    currency: dispute.currency,
    disputeReason: dispute.reason,
    disputeStatus: dispute.status,
    evidenceDueDate,
  })

  if (!emailResult.success) {
    debugError('Webhook', `Failed to send ${eventType} email:`, emailResult.error)
    // Don't fail the webhook if email fails - log and continue
  } else {
    debugLog('Webhook', `Dispute ${eventType} email sent for store ${dbSubscription.store_id}`)
  }
}
