-- Migration: Fix store_users DELETE recursion
-- Description: Use SECURITY DEFINER helper for DELETE policy to prevent recursion
-- Date: 2026-02-09

-- ============================================================================
-- Fix: store_users DELETE policy has recursion
-- ============================================================================

-- Create helper function to check if user is Owner at store
CREATE OR REPLACE FUNCTION is_user_owner_at_store(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- Check if user is Owner at this store
  RETURN EXISTS (
    SELECT 1
    FROM store_users
    WHERE user_id = auth.uid()
      AND store_id = p_store_id
      AND role = 'Owner'
  );
END;
$$;

COMMENT ON FUNCTION is_user_owner_at_store(UUID) IS
  'Returns true if current user is Owner at the specified store. SECURITY DEFINER bypasses RLS to prevent recursion.';

-- Drop old DELETE policy
DROP POLICY IF EXISTS "store_users_delete" ON store_users;

-- Rebuild DELETE policy using SECURITY DEFINER helper (no recursion)
CREATE POLICY "store_users_delete" ON store_users
  FOR DELETE TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR
    -- Only Owners can remove team members
    is_user_owner_at_store(store_users.store_id)
  );

COMMENT ON POLICY "store_users_delete" ON store_users IS
  'Only Owners can remove team members from their stores. Uses SECURITY DEFINER to prevent recursion.';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Migration 034 Complete ===';
  RAISE NOTICE 'Fixed store_users DELETE policy (no recursion)';
  RAISE NOTICE '';
  RAISE NOTICE 'Run tests: npm test';
  RAISE NOTICE 'Expected: 862/862 passing (no timeouts)';
END $$;
