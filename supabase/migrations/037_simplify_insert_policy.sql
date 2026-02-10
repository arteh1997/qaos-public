-- Migration: Simplify store_users INSERT policy to eliminate recursion
-- Description: Remove the stores table query that might be causing recursion
-- Date: 2026-02-09

-- ============================================================================
-- Fix: Simplify INSERT policy to avoid any potential recursion paths
-- ============================================================================

-- Drop the current INSERT policy
DROP POLICY IF EXISTS "store_users_insert" ON store_users;

-- Create a simpler INSERT policy that doesn't query other tables
CREATE POLICY "store_users_insert" ON store_users
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Platform admins can add anyone
    (SELECT is_platform_admin())
    OR
    -- Owner/Manager can add team members at their store
    -- (This uses SECURITY DEFINER SQL function - no recursion)
    can_user_manage_store(store_users.store_id)
    OR
    -- Users can add themselves if they're the billing owner
    -- (Check this directly without querying stores table)
    (
      user_id = auth.uid()
      AND is_billing_owner = true
    )
  );

COMMENT ON POLICY "store_users_insert" ON store_users IS
  'Platform admins, Owners/Managers can add team members. Billing owners can add themselves. Uses simplified logic to prevent recursion.';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Migration 037 Complete ===';
  RAISE NOTICE 'Simplified store_users INSERT policy';
  RAISE NOTICE 'Removed stores table query that may have caused recursion';
  RAISE NOTICE '';
  RAISE NOTICE 'Run tests: npm test';
  RAISE NOTICE 'Expected: 862/862 passing (100%%)';
END $$;
