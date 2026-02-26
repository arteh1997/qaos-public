-- Migration 052: Notification Preferences
-- Adds user-configurable notification preferences for transactional emails
-- (shifts, payroll, purchase orders, account events)
-- Separate from alert_preferences (migration 039) which handles inventory alerts

-- ============================================================================
-- 1. Create notification_preferences table
-- ============================================================================

CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Shift notifications (primarily Staff)
  shift_assigned BOOLEAN NOT NULL DEFAULT true,
  shift_updated BOOLEAN NOT NULL DEFAULT true,
  shift_cancelled BOOLEAN NOT NULL DEFAULT true,

  -- Payroll notifications (all roles)
  payslip_available BOOLEAN NOT NULL DEFAULT true,

  -- Purchase order notifications (Owner, Manager)
  po_supplier_update BOOLEAN NOT NULL DEFAULT true,
  delivery_received BOOLEAN NOT NULL DEFAULT true,

  -- Account notifications (all roles)
  removed_from_store BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, store_id)
);

CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX idx_notification_preferences_store_id ON notification_preferences(store_id);

COMMENT ON TABLE notification_preferences IS 'Per-user, per-store notification preferences for transactional emails';

-- ============================================================================
-- 2. RLS Policies
-- ============================================================================

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences"
  ON notification_preferences
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own notification preferences"
  ON notification_preferences
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own notification preferences"
  ON notification_preferences
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notification preferences"
  ON notification_preferences
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- 3. Auto-create defaults when user is added to a store
-- ============================================================================

CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO notification_preferences (user_id, store_id)
  VALUES (NEW.user_id, NEW.store_id)
  ON CONFLICT (user_id, store_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_default_notification_preferences_trigger
  AFTER INSERT ON store_users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_preferences();

COMMENT ON FUNCTION create_default_notification_preferences() IS 'Creates default notification preferences when any user is added to a store';

-- ============================================================================
-- 4. Updated_at trigger
-- ============================================================================

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. Expand alert_history alert_type CHECK to include notification types
-- ============================================================================

ALTER TABLE alert_history DROP CONSTRAINT IF EXISTS alert_history_alert_type_check;
ALTER TABLE alert_history ADD CONSTRAINT alert_history_alert_type_check
  CHECK (alert_type IN (
    -- Existing inventory alert types
    'low_stock', 'critical_stock', 'missing_count', 'digest',
    -- New notification types
    'shift_assigned', 'shift_updated', 'shift_cancelled',
    'payslip_available', 'po_supplier_update', 'delivery_received',
    'removed_from_store', 'payment_succeeded', 'subscription_cancelled',
    'supplier_portal_invite'
  ));
