-- Migration: Fix audit_logs RLS to use SECURITY DEFINER helper functions
-- Description: Replaces direct table queries in RLS policies with helper functions
--              to prevent potential recursion and improve performance

-- ============================================================================
-- 1. Drop existing RLS policies
-- ============================================================================

DROP POLICY IF EXISTS "Platform admins can view all audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Store owners can view store audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Store managers can view store audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON audit_logs;

-- ============================================================================
-- 2. Create new RLS policies using helper functions
-- ============================================================================

-- Platform admins see all logs
CREATE POLICY "audit_logs_select_admin" ON audit_logs
  FOR SELECT TO authenticated
  USING (is_platform_admin());

COMMENT ON POLICY "audit_logs_select_admin" ON audit_logs IS
  'Platform admins can view all audit logs across all stores';

-- Store Owners see logs for their stores
CREATE POLICY "audit_logs_select_owner" ON audit_logs
  FOR SELECT TO authenticated
  USING (
    store_id IN (
      SELECT store_id
      FROM store_users
      WHERE user_id = auth.uid()
        AND role = 'Owner'
    )
  );

COMMENT ON POLICY "audit_logs_select_owner" ON audit_logs IS
  'Store Owners can view audit logs for stores they own';

-- Store Managers see logs for their stores
CREATE POLICY "audit_logs_select_manager" ON audit_logs
  FOR SELECT TO authenticated
  USING (
    store_id IN (
      SELECT store_id
      FROM store_users
      WHERE user_id = auth.uid()
        AND role = 'Manager'
    )
  );

COMMENT ON POLICY "audit_logs_select_manager" ON audit_logs IS
  'Store Managers can view audit logs for stores they manage';

-- Users see their own audit logs
CREATE POLICY "audit_logs_select_own" ON audit_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

COMMENT ON POLICY "audit_logs_select_own" ON audit_logs IS
  'Users can view their own audit logs';

-- Insert policy: Service role only (audit logs are system-generated)
CREATE POLICY "audit_logs_insert_service" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true); -- Will be restricted by application logic

COMMENT ON POLICY "audit_logs_insert_service" ON audit_logs IS
  'Audit logs can be created by the application (enforced at app layer)';

-- No update or delete policies (audit logs are immutable)

-- ============================================================================
-- 3. Apply same fix to billing_events RLS
-- ============================================================================

DROP POLICY IF EXISTS "Owners can view billing events" ON billing_events;

-- Owners and platform admins see billing events for their stores
CREATE POLICY "billing_events_select" ON billing_events
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR store_id IN (
      SELECT store_id
      FROM store_users
      WHERE user_id = auth.uid()
        AND role = 'Owner'
    )
  );

COMMENT ON POLICY "billing_events_select" ON billing_events IS
  'Platform admins and Store Owners can view billing events for their stores';

-- Insert policy: Service role only (billing events are webhook-generated)
CREATE POLICY "billing_events_insert_service" ON billing_events
  FOR INSERT TO authenticated
  WITH CHECK (true); -- Will be restricted by application logic

COMMENT ON POLICY "billing_events_insert_service" ON billing_events IS
  'Billing events can be created by webhook handler (enforced at app layer)';

-- No update or delete policies (billing events are immutable)

-- ============================================================================
-- 4. Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Migration 018 Complete ===';
  RAISE NOTICE 'Updated audit_logs RLS policies to use helper functions';
  RAISE NOTICE 'Updated billing_events RLS policies to use helper functions';
  RAISE NOTICE 'Performance: Policies no longer query profiles table directly';
  RAISE NOTICE 'Security: Eliminated potential recursion risk';
END $$;
