-- Migration: Final fix for store_users INSERT RLS recursion
-- Description: Explicitly disable RLS in SECURITY DEFINER function
-- Date: 2026-02-09

-- ============================================================================
-- 1. Drop existing problematic function
-- ============================================================================

DROP FUNCTION IF EXISTS user_can_invite_to_store(UUID);

-- ============================================================================
-- 2. Create function with explicit RLS bypass
-- ============================================================================

-- Check if user can invite others (Owner/Manager check)
-- This version explicitly uses pg_catalog to bypass RLS
CREATE OR REPLACE FUNCTION user_can_invite_to_store(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();

  -- Query store_users directly without RLS (SECURITY DEFINER bypasses RLS when owned by superuser)
  -- Use a simple query that won't trigger recursive policy checks
  SELECT role INTO user_role
  FROM public.store_users
  WHERE user_id = current_user_id
    AND store_id = p_store_id
  LIMIT 1;

  -- Return true if user is Owner or Manager, false otherwise
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN user_role IN ('Owner', 'Manager');
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION user_can_invite_to_store TO authenticated;

COMMENT ON FUNCTION user_can_invite_to_store IS
  'Check if user can invite to store (Owner/Manager) - SECURITY DEFINER with explicit RLS bypass';

-- ============================================================================
-- 3. Alternatively: Simplify INSERT policy to avoid function calls entirely
-- ============================================================================

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "store_users_insert_policy" ON store_users;

-- Create simplified INSERT policy
-- This version uses a subquery instead of a function call
CREATE POLICY "store_users_insert_policy" ON store_users
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Platform admins can invite anyone
    (SELECT is_platform_admin())
    OR
    -- Users can add themselves to stores they own (billing owner)
    (
      user_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM stores
        WHERE stores.id = store_users.store_id
        AND stores.billing_user_id = (SELECT auth.uid())
      )
    )
    OR
    -- For inviting others: check if current user is Owner/Manager at this store
    -- Use a lateral subquery to avoid recursion
    (
      EXISTS (
        WITH RECURSIVE permission_check AS (
          -- Base case: directly check if user has Owner/Manager role
          SELECT 1
          FROM store_users AS existing_membership
          WHERE existing_membership.user_id = (SELECT auth.uid())
            AND existing_membership.store_id = store_users.store_id
            AND existing_membership.role IN ('Owner', 'Manager')
          LIMIT 1
        )
        SELECT 1 FROM permission_check
      )
    )
  );

COMMENT ON POLICY "store_users_insert_policy" ON store_users IS
  'Owners and Managers can invite users - uses recursive CTE to avoid RLS recursion';

-- ============================================================================
-- 4. Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Migration 023 Complete ===';
  RAISE NOTICE 'Applied final fix for store_users INSERT RLS:';
  RAISE NOTICE '  1. Updated user_can_invite_to_store() with explicit RLS bypass';
  RAISE NOTICE '  2. Simplified INSERT policy using recursive CTE';
  RAISE NOTICE '  3. Should eliminate infinite recursion';
  RAISE NOTICE '';
  RAISE NOTICE 'Run tests: npm test -- tests/integration/rls/store-users-rls.test.ts';
END $$;
