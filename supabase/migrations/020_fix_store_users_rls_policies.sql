-- Migration: Fix store_users RLS policies
-- Description: Allow Staff to view team members and Managers to invite users
-- Date: 2026-02-09

-- ============================================================================
-- 1. Fix SELECT policy - Allow all store members to see their teammates
-- ============================================================================

DROP POLICY IF EXISTS "store_users_select_store_members" ON store_users;

-- All store members (Owner, Manager, Staff, Driver) can see their teammates
CREATE POLICY "store_users_select_store_members" ON store_users
  FOR SELECT TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR EXISTS (
      SELECT 1 FROM store_users su
      WHERE su.user_id = (SELECT auth.uid())
        AND su.store_id = store_users.store_id
    )
  );

COMMENT ON POLICY "store_users_select_store_members" ON store_users IS
  'All store members can view their teammates';

-- ============================================================================
-- 2. Fix INSERT policy - Allow Managers to invite users too
-- ============================================================================

DROP POLICY IF EXISTS "store_users_insert_policy" ON store_users;

-- Owners and Managers can invite users to their stores
CREATE POLICY "store_users_insert_policy" ON store_users
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_platform_admin())
    OR (SELECT get_user_role_at_store(store_id)) IN ('Owner', 'Manager')
    OR (
      -- Allow users to add themselves to stores they own (billing owner)
      user_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM stores
        WHERE stores.id = store_users.store_id
        AND stores.billing_user_id = (SELECT auth.uid())
      )
    )
  );

COMMENT ON POLICY "store_users_insert_policy" ON store_users IS
  'Owners and Managers can invite users to their stores';

-- ============================================================================
-- 3. Verification query
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Migration 020 Complete ===';
  RAISE NOTICE 'Fixed store_users RLS policies:';
  RAISE NOTICE '  1. All store members can now view their teammates (including Staff)';
  RAISE NOTICE '  2. Managers can now invite users to their stores (not just Owners)';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT: Run RLS integration tests to verify:';
  RAISE NOTICE '  npm test -- tests/integration/rls/store-users-rls.test.ts';
END $$;
