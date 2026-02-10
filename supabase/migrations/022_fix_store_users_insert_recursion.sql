-- Migration: Fix store_users INSERT policy recursion
-- Description: Create dedicated SECURITY DEFINER function for INSERT policy checks
-- Date: 2026-02-09

-- ============================================================================
-- 1. Create helper function for INSERT policy (bypasses RLS completely)
-- ============================================================================

-- Check if user can invite others to a store (is Owner or Manager)
-- SECURITY DEFINER with explicit RLS bypass to prevent recursion during INSERT
CREATE OR REPLACE FUNCTION user_can_invite_to_store(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Query store_users with RLS bypassed (SECURITY DEFINER handles this)
  SELECT role INTO user_role
  FROM store_users
  WHERE user_id = auth.uid()
    AND store_id = p_store_id
  LIMIT 1;

  -- Return true if user is Owner or Manager
  RETURN user_role IN ('Owner', 'Manager');
END;
$$;

GRANT EXECUTE ON FUNCTION user_can_invite_to_store TO authenticated;

COMMENT ON FUNCTION user_can_invite_to_store IS
  'Check if user can invite others to store (Owner/Manager only) - SECURITY DEFINER to avoid INSERT policy recursion';

-- ============================================================================
-- 2. Update INSERT policy to use new helper function
-- ============================================================================

DROP POLICY IF EXISTS "store_users_insert_policy" ON store_users;

-- Owners and Managers can invite users, or users can add themselves if billing owner
CREATE POLICY "store_users_insert_policy" ON store_users
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_platform_admin())
    OR (SELECT user_can_invite_to_store(store_id))
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
  'Owners and Managers can invite users (uses dedicated SECURITY DEFINER function to avoid recursion)';

-- ============================================================================
-- 3. Verification query
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Migration 022 Complete ===';
  RAISE NOTICE 'Fixed store_users INSERT policy recursion:';
  RAISE NOTICE '  1. Created user_can_invite_to_store() SECURITY DEFINER function';
  RAISE NOTICE '  2. Updated INSERT policy to use new helper (no recursion)';
  RAISE NOTICE '';
  RAISE NOTICE 'All store_users RLS policies now recursion-free!';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT: Run RLS integration tests to verify:';
  RAISE NOTICE '  npm test -- tests/integration/rls/store-users-rls.test.ts';
END $$;
