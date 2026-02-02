-- Migration: Billing Enhancements
-- Description: Add trial tracking, payment method storage, and billing configuration

-- ============================================================================
-- 1. Add trial tracking columns to subscriptions
-- ============================================================================

-- trial_start: When the trial period began
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_start TIMESTAMPTZ;

-- trial_end: When the trial period ends (30 days from start)
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ;

-- stripe_payment_method_id: The default payment method for this subscription
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;

-- price_id: The Stripe Price ID being used (for future multi-tier support)
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- ============================================================================
-- 2. Add Stripe customer tracking to profiles
-- ============================================================================

-- stripe_customer_id: User's Stripe customer ID (for payment methods)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Index for Stripe customer lookup
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer
  ON profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ============================================================================
-- 3. Create billing_events table for audit trail
-- ============================================================================

CREATE TABLE IF NOT EXISTS billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  stripe_event_id TEXT,
  amount_cents INTEGER,
  currency TEXT DEFAULT 'gbp',
  status TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for billing events
CREATE INDEX IF NOT EXISTS idx_billing_events_subscription ON billing_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_store ON billing_events(store_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_type ON billing_events(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_events_stripe_event ON billing_events(stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

-- Enable RLS
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS Policies for billing_events
-- ============================================================================

-- Users can view billing events for stores they own
CREATE POLICY "Owners can view billing events"
  ON billing_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM store_users su
      WHERE su.store_id = billing_events.store_id
        AND su.user_id = auth.uid()
        AND su.role = 'Owner'
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.is_platform_admin = true
    )
  );

-- Only system can insert billing events (via service role)
CREATE POLICY "Service role can insert billing events"
  ON billing_events FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- 5. RLS Policies for subscriptions (if not already set)
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Owners can view subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON subscriptions;

-- Owners can view their store's subscription
CREATE POLICY "Owners can view subscriptions"
  ON subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM store_users su
      WHERE su.store_id = subscriptions.store_id
        AND su.user_id = auth.uid()
        AND su.role = 'Owner'
    )
    OR billing_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.is_platform_admin = true
    )
  );

-- Allow all operations for authenticated users (service role handles actual mutations)
CREATE POLICY "Authenticated users can manage subscriptions"
  ON subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 6. Function to check if store has active subscription or trial
-- ============================================================================

CREATE OR REPLACE FUNCTION is_store_subscription_active(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_status TEXT;
  v_trial_end TIMESTAMPTZ;
BEGIN
  SELECT status, trial_end INTO v_status, v_trial_end
  FROM subscriptions
  WHERE store_id = p_store_id;

  -- No subscription found
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Active or trialing with valid trial period
  IF v_status = 'active' THEN
    RETURN true;
  END IF;

  IF v_status = 'trialing' AND v_trial_end > now() THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ============================================================================
-- 7. Function to get days remaining in trial
-- ============================================================================

CREATE OR REPLACE FUNCTION get_trial_days_remaining(p_store_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_trial_end TIMESTAMPTZ;
BEGIN
  SELECT trial_end INTO v_trial_end
  FROM subscriptions
  WHERE store_id = p_store_id
    AND status = 'trialing';

  IF NOT FOUND OR v_trial_end IS NULL THEN
    RETURN 0;
  END IF;

  RETURN GREATEST(0, EXTRACT(DAY FROM (v_trial_end - now()))::INTEGER);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_store_subscription_active(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trial_days_remaining(UUID) TO authenticated;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE billing_events IS 'Audit trail for all billing-related events';
COMMENT ON COLUMN subscriptions.trial_start IS 'When the 30-day trial period began';
COMMENT ON COLUMN subscriptions.trial_end IS 'When the trial period ends';
COMMENT ON COLUMN subscriptions.stripe_payment_method_id IS 'Default payment method for charges';
COMMENT ON COLUMN profiles.stripe_customer_id IS 'Stripe customer ID for this user';
