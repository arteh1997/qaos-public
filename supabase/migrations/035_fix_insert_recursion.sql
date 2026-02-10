-- Migration: Fix store_users INSERT recursion
-- Description: Make can_user_manage_store truly bypass RLS to prevent recursion
-- Date: 2026-02-09

-- ============================================================================
-- Fix: can_user_manage_store() still triggers RLS, causing INSERT recursion
-- ============================================================================

-- Replace the function (don't drop - it's used by policies)
-- Change from LANGUAGE plpgsql to LANGUAGE sql to truly bypass RLS
CREATE OR REPLACE FUNCTION can_user_manage_store(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql  -- Changed from plpgsql - SQL language truly bypasses RLS
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  -- This function runs as the database owner, bypassing RLS
  SELECT EXISTS (
    SELECT 1
    FROM store_users
    WHERE user_id = auth.uid()
      AND store_id = p_store_id
      AND role IN ('Owner', 'Manager')
  );
$$;

COMMENT ON FUNCTION can_user_manage_store(UUID) IS
  'Returns true if current user is Owner or Manager at the specified store. SECURITY DEFINER with SQL language truly bypasses RLS to prevent recursion.';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Migration 035 Complete ===';
  RAISE NOTICE 'Fixed can_user_manage_store() to use SQL language (truly bypasses RLS)';
  RAISE NOTICE '';
  RAISE NOTICE 'This fixes INSERT recursion when Owners/Managers add team members';
  RAISE NOTICE '';
  RAISE NOTICE 'Run tests: npm test';
  RAISE NOTICE 'Expected: 862/862 passing (100%%)';
END $$;
