import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/config'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncSubscriptionToDatabase, logBillingEvent } from '@/lib/stripe/server'
import { sendPaymentFailureEmail, sendTrialEndingEmail } from '@/lib/email'
import { debugLog, debugError } from '@/lib/debug'
import {
  getSubscriptionFromInvoice,
  handleDisputeEvent,
} from '@/lib/services/billingEventHandlers'
import Stripe from 'stripe'

/**
 * POST /api/billing/webhook
 * Handle Stripe webhook events
 */
export async function POST(request: NextRequest) {
  const payload = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    )
  } catch (err) {
    debugError('Webhook', 'Signature verification failed:', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  const supabaseAdmin = createAdminClient()

  try {
    // SECURITY: Check if this event has already been processed
    // Stripe may retry webhooks on timeout, so we deduplicate by event ID
    const { data: existingEvent } = await supabaseAdmin
      .from('billing_events')
      .select('id')
      .eq('stripe_event_id', event.id)
      .single()

    if (existingEvent) {
      debugLog('Webhook', `Event ${event.id} already processed, skipping`)
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 })
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const storeId = subscription.metadata?.store_id

        if (storeId) {
          await syncSubscriptionToDatabase(subscription, storeId)
          await logBillingEvent(event.type, storeId, subscription.metadata?.user_id || null, {
            stripeEventId: event.id,
            status: subscription.status,
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const storeId = subscription.metadata?.store_id

        if (storeId) {
          // Update subscription status to canceled
          await supabaseAdmin
            .from('subscriptions')
            .update({
              status: 'canceled',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', subscription.id)

          // Update store subscription status
          await supabaseAdmin
            .from('stores')
            .update({
              subscription_status: 'canceled',
              updated_at: new Date().toISOString(),
            })
            .eq('id', storeId)

          await logBillingEvent('subscription.deleted', storeId, null, {
            stripeEventId: event.id,
            status: 'canceled',
          })
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string

        if (subscriptionId) {
          const dbSubscription = await getSubscriptionFromInvoice(supabaseAdmin, subscriptionId)

          if (dbSubscription) {
            await logBillingEvent('invoice.paid', dbSubscription.store_id, dbSubscription.billing_user_id, {
              stripeEventId: event.id,
              amountCents: invoice.amount_paid,
              currency: invoice.currency,
              status: 'paid',
              metadata: {
                invoice_id: invoice.id,
                invoice_number: invoice.number,
              },
            })
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string

        if (subscriptionId) {
          const dbSubscription = await getSubscriptionFromInvoice(supabaseAdmin, subscriptionId)

          if (dbSubscription) {
            // Update subscription status
            await supabaseAdmin
              .from('subscriptions')
              .update({
                status: 'past_due',
                updated_at: new Date().toISOString(),
              })
              .eq('stripe_subscription_id', subscriptionId)

            await supabaseAdmin
              .from('stores')
              .update({
                subscription_status: 'past_due',
                updated_at: new Date().toISOString(),
              })
              .eq('id', dbSubscription.store_id)

            await logBillingEvent('invoice.payment_failed', dbSubscription.store_id, dbSubscription.billing_user_id, {
              stripeEventId: event.id,
              amountCents: invoice.amount_due,
              currency: invoice.currency,
              status: 'failed',
              metadata: {
                invoice_id: invoice.id,
                attempt_count: invoice.attempt_count,
              },
            })

            // Send email notification to billing owner
            const nextRetryDate = invoice.next_payment_attempt
              ? new Date(invoice.next_payment_attempt * 1000)
              : undefined

            const emailResult = await sendPaymentFailureEmail({
              storeId: dbSubscription.store_id,
              attemptCount: invoice.attempt_count || 1,
              amountDue: invoice.amount_due || 0,
              currency: invoice.currency || 'usd',
              nextRetryDate,
            })

            if (!emailResult.success) {
              debugError('Webhook', 'Failed to send payment failure email:', emailResult.error)
              // Don't fail the webhook if email fails - log and continue
            } else {
              debugLog('Webhook', `Payment failure email sent for store ${dbSubscription.store_id}`)
            }
          }
        }
        break
      }

      case 'customer.subscription.trial_will_end': {
        // Sent 3 days before trial ends
        const subscription = event.data.object as Stripe.Subscription
        const storeId = subscription.metadata?.store_id

        if (storeId) {
          await logBillingEvent('trial.ending_soon', storeId, subscription.metadata?.user_id || null, {
            stripeEventId: event.id,
            status: subscription.status,
            metadata: {
              trial_end: subscription.trial_end
                ? new Date(subscription.trial_end * 1000).toISOString()
                : null,
            },
          })

          // Send email notification to billing owner
          if (subscription.trial_end) {
            const trialEndsAt = new Date(subscription.trial_end * 1000)

            const emailResult = await sendTrialEndingEmail({
              storeId,
              trialEndsAt,
            })

            if (!emailResult.success) {
              debugError('Webhook', 'Failed to send trial ending email:', emailResult.error)
              // Don't fail the webhook if email fails - log and continue
            } else {
              debugLog('Webhook', `Trial ending email sent for store ${storeId}`)
            }
          }
        }
        break
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute
        await handleDisputeEvent(supabaseAdmin, dispute, 'dispute.created', event.id)
        break
      }

      case 'charge.dispute.updated': {
        const dispute = event.data.object as Stripe.Dispute
        await handleDisputeEvent(supabaseAdmin, dispute, 'dispute.updated', event.id)
        break
      }

      case 'charge.dispute.closed': {
        const dispute = event.data.object as Stripe.Dispute
        await handleDisputeEvent(supabaseAdmin, dispute, 'dispute.closed', event.id)
        break
      }

      default:
        // Unhandled event type
        debugLog('Webhook', `Unhandled webhook event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    debugError('Webhook', 'Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
