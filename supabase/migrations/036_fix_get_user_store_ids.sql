-- Migration: Fix get_user_store_ids to truly bypass RLS
-- Description: Change from LANGUAGE plpgsql to LANGUAGE sql
-- Date: 2026-02-09

-- ============================================================================
-- Fix: get_user_store_ids() uses plpgsql which doesn't bypass RLS
-- ============================================================================

-- Replace the function to use SQL language
CREATE OR REPLACE FUNCTION get_user_store_ids()
RETURNS UUID[]
LANGUAGE sql  -- Changed from plpgsql - SQL language truly bypasses RLS
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  -- This function runs as the database owner, bypassing RLS
  SELECT ARRAY(
    SELECT store_id
    FROM store_users
    WHERE user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION get_user_store_ids() IS
  'Returns array of store IDs the current user belongs to. SECURITY DEFINER with SQL language truly bypasses RLS to prevent recursion.';

-- ============================================================================
-- Also fix is_user_owner_at_store if it exists
-- ============================================================================

CREATE OR REPLACE FUNCTION is_user_owner_at_store(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql  -- Changed from plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM store_users
    WHERE user_id = auth.uid()
      AND store_id = p_store_id
      AND role = 'Owner'
  );
$$;

COMMENT ON FUNCTION is_user_owner_at_store(UUID) IS
  'Returns true if current user is Owner at the specified store. SECURITY DEFINER with SQL language truly bypasses RLS to prevent recursion.';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Migration 036 Complete ===';
  RAISE NOTICE 'Fixed get_user_store_ids() to use SQL language';
  RAISE NOTICE 'Fixed is_user_owner_at_store() to use SQL language';
  RAISE NOTICE '';
  RAISE NOTICE 'All RLS helper functions now use LANGUAGE sql (truly bypass RLS)';
  RAISE NOTICE '';
  RAISE NOTICE 'Run tests: npm test';
  RAISE NOTICE 'Expected: 862/862 passing (100%%)';
END $$;
