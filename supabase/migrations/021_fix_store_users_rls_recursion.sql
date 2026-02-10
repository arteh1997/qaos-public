-- Migration: Fix store_users RLS infinite recursion
-- Description: Replace recursive policy with SECURITY DEFINER helper function
-- Date: 2026-02-09

-- ============================================================================
-- 1. Create SECURITY DEFINER helper function
-- ============================================================================

-- Check if user has access to a specific store (via store_users membership)
-- SECURITY DEFINER bypasses RLS, preventing recursion
CREATE OR REPLACE FUNCTION user_has_store_membership(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM store_users
    WHERE user_id = (SELECT auth.uid())
      AND store_id = p_store_id
  );
$$;

GRANT EXECUTE ON FUNCTION user_has_store_membership TO authenticated;

COMMENT ON FUNCTION user_has_store_membership IS
  'Check if current user has membership at a store (SECURITY DEFINER to avoid RLS recursion)';

-- ============================================================================
-- 2. Fix SELECT policies - Remove recursion
-- ============================================================================

DROP POLICY IF EXISTS "store_users_select_store_members" ON store_users;

-- All store members can see their teammates (uses SECURITY DEFINER helper)
CREATE POLICY "store_users_select_store_members" ON store_users
  FOR SELECT TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR (SELECT user_has_store_membership(store_users.store_id))
  );

COMMENT ON POLICY "store_users_select_store_members" ON store_users IS
  'All store members can view their teammates (uses SECURITY DEFINER to avoid recursion)';

-- ============================================================================
-- 3. Fix INSERT policy - Allow Managers to invite users
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
-- 4. Verification query
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Migration 021 Complete ===';
  RAISE NOTICE 'Fixed store_users RLS infinite recursion:';
  RAISE NOTICE '  1. Created user_has_store_membership() SECURITY DEFINER function';
  RAISE NOTICE '  2. Updated SELECT policy to use helper function (no recursion)';
  RAISE NOTICE '  3. Updated INSERT policy to allow Managers to invite users';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT: Run RLS integration tests to verify:';
  RAISE NOTICE '  npm test -- tests/integration/rls/';
END $$;
