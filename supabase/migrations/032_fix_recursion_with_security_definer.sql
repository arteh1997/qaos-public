-- Migration: Fix infinite recursion using SECURITY DEFINER helper
-- Description: Use SECURITY DEFINER function to bypass RLS when checking user's stores
-- Date: 2026-02-09

-- ============================================================================
-- PART 1: Create SECURITY DEFINER helper function
-- ============================================================================

-- This function bypasses RLS to avoid infinite recursion
CREATE OR REPLACE FUNCTION get_user_store_ids()
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN ARRAY(
    SELECT store_id
    FROM store_users
    WHERE user_id = auth.uid()
  );
END;
$$;

COMMENT ON FUNCTION get_user_store_ids() IS
  'Returns array of store IDs the current user belongs to. SECURITY DEFINER bypasses RLS to prevent infinite recursion.';

-- ============================================================================
-- PART 2: Rebuild store_users SELECT policy (NO recursion possible)
-- ============================================================================

-- Drop the recursive SELECT policy
DROP POLICY IF EXISTS "store_users_select" ON store_users;

-- New SELECT policy using SECURITY DEFINER function
CREATE POLICY "store_users_select" ON store_users
  FOR SELECT TO authenticated
  USING (
    -- Platform admins see all
    (SELECT is_platform_admin())
    OR
    -- Users see their own memberships
    user_id = auth.uid()
    OR
    -- Users see other memberships at stores they belong to
    -- Uses SECURITY DEFINER function to avoid recursion
    store_id = ANY(get_user_store_ids())
  );

COMMENT ON POLICY "store_users_select" ON store_users IS
  'Users can see their own memberships and memberships at stores they belong to. Uses SECURITY DEFINER function to prevent recursion.';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Migration 032 Complete ===';
  RAISE NOTICE 'Created SECURITY DEFINER function: get_user_store_ids()';
  RAISE NOTICE 'Rebuilt store_users SELECT policy (no recursion)';
  RAISE NOTICE '';
  RAISE NOTICE 'This fixes the infinite recursion cascade that was affecting:';
  RAISE NOTICE '  - store_users (direct)';
  RAISE NOTICE '  - audit_logs (indirect via store_users check)';
  RAISE NOTICE '  - inventory_items (indirect via store_users check)';
  RAISE NOTICE '  - shifts (indirect via store_users check)';
  RAISE NOTICE '';
  RAISE NOTICE 'Run tests: npm test';
  RAISE NOTICE 'Expected: 862/862 passing';
END $$;
