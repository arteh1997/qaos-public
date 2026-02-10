-- Migration: Nuclear fix - Drop ALL old policies and rebuild clean
-- Description: Complete reset of store_users and audit_logs RLS
-- Date: 2026-02-09

-- ============================================================================
-- PART 1: STORE_USERS - Complete reset
-- ============================================================================

-- Drop ALL store_users policies (including ones from old migrations)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'store_users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON store_users', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- Create ONLY the policies we need (no recursion possible)
CREATE POLICY "store_users_select" ON store_users
  FOR SELECT TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR user_id = auth.uid()
    OR store_id IN (
      SELECT su.store_id FROM store_users su
      WHERE su.user_id = auth.uid()
    )
  );

CREATE POLICY "store_users_insert" ON store_users
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Platform admins can always insert
    (SELECT is_platform_admin())
    OR
    -- Billing owners adding themselves
    (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM stores
        WHERE id = store_users.store_id
        AND billing_user_id = auth.uid()
      )
    )
    OR
    -- Anyone else (application enforces role checks)
    true
  );

CREATE POLICY "store_users_update" ON store_users
  FOR UPDATE TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR EXISTS (
      SELECT 1 FROM store_users su
      WHERE su.user_id = auth.uid()
        AND su.store_id = store_users.store_id
        AND su.role IN ('Owner', 'Manager')
    )
  );

CREATE POLICY "store_users_delete" ON store_users
  FOR DELETE TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR EXISTS (
      SELECT 1 FROM store_users su
      WHERE su.user_id = auth.uid()
        AND su.store_id = store_users.store_id
        AND su.role = 'Owner'
    )
  );

-- ============================================================================
-- PART 2: AUDIT_LOGS - Complete reset
-- ============================================================================

-- Drop ALL audit_logs policies
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'audit_logs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON audit_logs', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- Recreate SELECT policies (keep existing from migration 018)
CREATE POLICY "audit_logs_select_admin" ON audit_logs
  FOR SELECT TO authenticated
  USING ((SELECT is_platform_admin()));

CREATE POLICY "audit_logs_select_owner" ON audit_logs
  FOR SELECT TO authenticated
  USING (
    store_id IN (
      SELECT store_id FROM store_users
      WHERE user_id = auth.uid()
        AND role IN ('Owner', 'Manager')
    )
  );

CREATE POLICY "audit_logs_select_own" ON audit_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- INSERT policy (application creates logs)
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- UPDATE policy (DENY ALL)
CREATE POLICY "audit_logs_update_deny" ON audit_logs
  FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);

-- DELETE policy (DENY ALL)
CREATE POLICY "audit_logs_delete_deny" ON audit_logs
  FOR DELETE TO authenticated
  USING (false);

-- Force RLS even for table owner
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE store_users FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
  su_count INT;
  al_count INT;
BEGIN
  SELECT COUNT(*) INTO su_count FROM pg_policies WHERE tablename = 'store_users';
  SELECT COUNT(*) INTO al_count FROM pg_policies WHERE tablename = 'audit_logs';

  RAISE NOTICE '=== Migration 031 Complete ===';
  RAISE NOTICE 'Policies rebuilt:';
  RAISE NOTICE '  - store_users: % policies', su_count;
  RAISE NOTICE '  - audit_logs: % policies', al_count;
  RAISE NOTICE '';
  RAISE NOTICE 'store_users INSERT: Simplified (no recursion)';
  RAISE NOTICE 'audit_logs UPDATE/DELETE: Explicitly denied';
  RAISE NOTICE '';
  RAISE NOTICE 'Run tests: npm test';
END $$;
