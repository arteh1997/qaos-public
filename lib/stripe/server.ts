/**
 * Stripe Server-Side Helpers
 */

import { stripe, BILLING_CONFIG } from './config'
import { createAdminClient } from '@/lib/supabase/admin'
import { Enums, Json } from '@/types/database'
import Stripe from 'stripe'

// Type alias for subscription status
type SubscriptionStatus = Enums<'subscription_status'>

/**
 * Get or create a Stripe customer for a user
 */
export async function getOrCreateCustomer(userId: string, email: string, name?: string): Promise<string> {
  const supabaseAdmin = createAdminClient()

  // Check if user already has a Stripe customer ID
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: {
      supabase_user_id: userId,
    },
  })

  // Save customer ID to profile
  await supabaseAdmin
    .from('profiles')
    .update({
      stripe_customer_id: customer.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  return customer.id
}

/**
 * Create a Setup Intent for collecting payment method
 */
export async function createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
  return stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
    usage: 'off_session', // Allow charging later without customer present
  })
}

/**
 * Create a subscription for a store with trial period
 */
export async function createSubscription(
  customerId: string,
  paymentMethodId: string,
  storeId: string,
  userId: string
): Promise<Stripe.Subscription> {
  // Set the payment method as default for the customer
  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  })

  // Get or create the price
  const priceId = await getOrCreatePrice()

  // Create subscription with trial
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    default_payment_method: paymentMethodId,
    trial_period_days: BILLING_CONFIG.TRIAL_DAYS,
    payment_behavior: 'default_incomplete',
    payment_settings: {
      save_default_payment_method: 'on_subscription',
    },
    metadata: {
      store_id: storeId,
      user_id: userId,
    },
    expand: ['latest_invoice.payment_intent'],
  })

  return subscription
}

/**
 * Get or create the product and price in Stripe
 */
async function getOrCreatePrice(): Promise<string> {
  // Check environment variable first
  if (process.env.STRIPE_PRICE_ID) {
    return process.env.STRIPE_PRICE_ID
  }

  // Try to find existing product
  const products = await stripe.products.list({
    active: true,
    limit: 1,
  })

  let productId: string

  if (products.data.length > 0 && products.data[0].name === BILLING_CONFIG.PRODUCT_NAME) {
    productId = products.data[0].id
  } else {
    // Create product
    const product = await stripe.products.create({
      name: BILLING_CONFIG.PRODUCT_NAME,
      description: 'Complete restaurant inventory management solution',
    })
    productId = product.id
  }

  // Check for existing price
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 1,
  })

  if (prices.data.length > 0) {
    return prices.data[0].id
  }

  // Create price
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: BILLING_CONFIG.PRICE_AMOUNT_PENCE,
    currency: BILLING_CONFIG.CURRENCY,
    recurring: {
      interval: 'month',
    },
  })

  return price.id
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  cancelImmediately: boolean = false
): Promise<Stripe.Subscription> {
  if (cancelImmediately) {
    return stripe.subscriptions.cancel(subscriptionId)
  }

  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  })
}

/**
 * Reactivate a subscription that was set to cancel
 */
export async function reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  })
}

/**
 * Update payment method for a subscription
 */
export async function updatePaymentMethod(
  customerId: string,
  subscriptionId: string,
  paymentMethodId: string
): Promise<void> {
  // Attach payment method to customer
  await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  })

  // Set as default for customer
  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  })

  // Update subscription's default payment method
  await stripe.subscriptions.update(subscriptionId, {
    default_payment_method: paymentMethodId,
  })
}

/**
 * Get customer's payment methods
 */
export async function getPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
  })

  return paymentMethods.data
}

/**
 * Verify webhook signature
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET || ''
  )
}

/**
 * Sync subscription status to database
 */
export async function syncSubscriptionToDatabase(
  stripeSubscription: Stripe.Subscription,
  storeId: string
): Promise<void> {
  const supabaseAdmin = createAdminClient()

  const now = new Date().toISOString()
  const trialEnd = stripeSubscription.trial_end
    ? new Date(stripeSubscription.trial_end * 1000).toISOString()
    : null

  const subscriptionData = {
    stripe_subscription_id: stripeSubscription.id,
    stripe_customer_id: stripeSubscription.customer as string,
    stripe_payment_method_id: stripeSubscription.default_payment_method as string | null,
    status: stripeSubscription.status as SubscriptionStatus,
    trial_start: stripeSubscription.trial_start
      ? new Date(stripeSubscription.trial_start * 1000).toISOString()
      : null,
    trial_end: trialEnd,
    current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: stripeSubscription.cancel_at_period_end,
    updated_at: now,
  }

  // Upsert subscription
  await supabaseAdmin
    .from('subscriptions')
    .upsert({
      store_id: storeId,
      billing_user_id: stripeSubscription.metadata?.user_id || '',
      ...subscriptionData,
    }, {
      onConflict: 'store_id',
    })

  // Update store's subscription status
  await supabaseAdmin
    .from('stores')
    .update({
      subscription_status: stripeSubscription.status as SubscriptionStatus,
      updated_at: now,
    })
    .eq('id', storeId)
}

/**
 * Log billing event
 */
export async function logBillingEvent(
  eventType: string,
  storeId: string | null,
  userId: string | null,
  data: {
    subscriptionId?: string
    stripeEventId?: string
    amountCents?: number
    currency?: string
    status?: string
    metadata?: Json
  }
): Promise<void> {
  const supabaseAdmin = createAdminClient()

  await supabaseAdmin
    .from('billing_events')
    .insert({
      event_type: eventType,
      store_id: storeId,
      user_id: userId,
      subscription_id: data.subscriptionId || null,
      stripe_event_id: data.stripeEventId || null,
      amount_cents: data.amountCents || null,
      currency: data.currency || 'gbp',
      status: data.status || null,
      metadata: data.metadata ?? {},
    })
}
