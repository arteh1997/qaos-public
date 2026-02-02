import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/config'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncSubscriptionToDatabase, logBillingEvent } from '@/lib/stripe/server'
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
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  const supabaseAdmin = createAdminClient()

  try {
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
          const { data: dbSubscription } = await supabaseAdmin
            .from('subscriptions')
            .select('store_id, billing_user_id')
            .eq('stripe_subscription_id', subscriptionId)
            .single()

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
          const { data: dbSubscription } = await supabaseAdmin
            .from('subscriptions')
            .select('store_id, billing_user_id')
            .eq('stripe_subscription_id', subscriptionId)
            .single()

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

            // TODO: Send email notification to billing owner about failed payment
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

          // TODO: Send email notification to billing owner about trial ending
        }
        break
      }

      default:
        // Unhandled event type
        console.log(`Unhandled webhook event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
