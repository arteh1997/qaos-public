-- Migration 039: Alert Preferences and Alert History
-- Adds user-configurable alert preferences and alert history tracking

-- ============================================================================
-- 1. Create alert_preferences table
-- ============================================================================

CREATE TABLE alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Alert toggles
  low_stock_enabled BOOLEAN NOT NULL DEFAULT true,
  critical_stock_enabled BOOLEAN NOT NULL DEFAULT true,  -- Items at 0 quantity
  missing_count_enabled BOOLEAN NOT NULL DEFAULT true,   -- Daily count not submitted

  -- Thresholds
  low_stock_threshold NUMERIC NOT NULL DEFAULT 1.0,  -- Multiplier of par_level (1.0 = at par, 0.5 = 50% of par)

  -- Frequency
  alert_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (alert_frequency IN ('daily', 'weekly', 'never')),

  -- Delivery
  email_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Timing
  preferred_hour INTEGER NOT NULL DEFAULT 8 CHECK (preferred_hour >= 0 AND preferred_hour <= 23),  -- Hour of day (UTC)

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(store_id, user_id)
);

CREATE INDEX idx_alert_preferences_store_id ON alert_preferences(store_id);
CREATE INDEX idx_alert_preferences_user_id ON alert_preferences(user_id);

COMMENT ON TABLE alert_preferences IS 'Per-store, per-user alert preference configuration';
COMMENT ON COLUMN alert_preferences.low_stock_threshold IS 'Multiplier of par_level. 1.0 = alert when at par, 0.5 = alert when below 50% of par';
COMMENT ON COLUMN alert_preferences.preferred_hour IS 'Hour of day (UTC, 0-23) to send daily digest alerts';

-- ============================================================================
-- 2. Create alert_history table
-- ============================================================================

CREATE TABLE alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_stock', 'critical_stock', 'missing_count', 'digest')),
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'in_app')),

  -- Content
  subject TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,  -- Number of items included in the alert

  -- Status
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'acknowledged')),
  error_message TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ
);

CREATE INDEX idx_alert_history_store_id ON alert_history(store_id);
CREATE INDEX idx_alert_history_user_id ON alert_history(user_id);
CREATE INDEX idx_alert_history_sent_at ON alert_history(sent_at DESC);
CREATE INDEX idx_alert_history_type ON alert_history(alert_type);

COMMENT ON TABLE alert_history IS 'Audit trail of all alerts sent to users';

-- ============================================================================
-- 3. RLS Policies for alert_preferences
-- ============================================================================

ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own alert preferences
CREATE POLICY "Users can view own alert preferences"
  ON alert_preferences
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can create their own alert preferences
CREATE POLICY "Users can create own alert preferences"
  ON alert_preferences
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own alert preferences
CREATE POLICY "Users can update own alert preferences"
  ON alert_preferences
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own alert preferences
CREATE POLICY "Users can delete own alert preferences"
  ON alert_preferences
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- 4. RLS Policies for alert_history
-- ============================================================================

ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own alert history
CREATE POLICY "Users can view own alert history"
  ON alert_history
  FOR SELECT
  USING (user_id = auth.uid());

-- System inserts only (via SECURITY DEFINER functions or service role)
-- No direct INSERT policy for regular users

-- ============================================================================
-- 5. Create default alert preferences trigger
-- ============================================================================

-- When a user is added to a store, create default alert preferences
CREATE OR REPLACE FUNCTION create_default_alert_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only create for Owner and Manager roles
  IF NEW.role IN ('Owner', 'Manager') THEN
    INSERT INTO alert_preferences (store_id, user_id)
    VALUES (NEW.store_id, NEW.user_id)
    ON CONFLICT (store_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_default_alert_preferences_trigger
  AFTER INSERT ON store_users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_alert_preferences();

COMMENT ON FUNCTION create_default_alert_preferences() IS 'Creates default alert preferences when Owner/Manager is added to a store';
