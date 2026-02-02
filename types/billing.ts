/**
 * Billing Types
 */

import { SubscriptionStatus } from '@/lib/stripe/config'

export interface Subscription {
  id: string
  store_id: string
  billing_user_id: string
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  stripe_payment_method_id: string | null
  stripe_price_id: string | null
  status: SubscriptionStatus
  trial_start: string | null
  trial_end: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

export interface BillingEvent {
  id: string
  subscription_id: string | null
  store_id: string | null
  user_id: string | null
  event_type: string
  stripe_event_id: string | null
  amount_cents: number | null
  currency: string
  status: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface PaymentMethod {
  id: string
  brand: string
  last4: string
  exp_month: number
  exp_year: number
  is_default: boolean
}

export interface BillingInfo {
  subscription: Subscription | null
  paymentMethod: PaymentMethod | null
  trialDaysRemaining: number
  isActive: boolean
  isTrial: boolean
  nextBillingDate: string | null
  amount: number
  currency: string
}

export interface CreateSubscriptionData {
  store_id: string
  payment_method_id: string
}

export interface SetupIntentResponse {
  clientSecret: string
  customerId: string
}

export interface SubscriptionResponse {
  subscription: Subscription
  clientSecret?: string
}
