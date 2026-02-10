-- Migration: Fix inventory_items RLS for proper multi-tenant isolation
-- Description: Scope inventory_items to user's accessible stores instead of global visibility
-- Security: CRITICAL - Prevents Store A from seeing Store B's inventory
-- Date: 2026-02-09

-- ============================================================================
-- 1. Drop existing overly permissive SELECT policy
-- ============================================================================

DROP POLICY IF EXISTS "inventory_items_select_policy" ON inventory_items;

-- ============================================================================
-- 2. Create new scoped SELECT policies
-- ============================================================================

-- Platform admins can see all inventory items
CREATE POLICY "inventory_items_select_admin" ON inventory_items
  FOR SELECT TO authenticated
  USING (is_platform_admin());

COMMENT ON POLICY "inventory_items_select_admin" ON inventory_items IS
  'Platform admins can view all inventory items across all stores';

-- Users can see inventory items for stores they have access to
CREATE POLICY "inventory_items_select_user" ON inventory_items
  FOR SELECT TO authenticated
  USING (
    store_id IN (
      SELECT store_id
      FROM store_users
      WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY "inventory_items_select_user" ON inventory_items IS
  'Users can view inventory items for stores they belong to';

-- ============================================================================
-- 3. Verification query
-- ============================================================================

-- After this migration, test that:
-- 1. Store A users cannot see Store B inventory items
-- 2. Multi-store users can see items from all their stores
-- 3. Platform admins can see all items

DO $$
BEGIN
  RAISE NOTICE '=== Migration 019 Complete ===';
  RAISE NOTICE 'Fixed inventory_items RLS for multi-tenant isolation';
  RAISE NOTICE 'Users can now only see inventory items for their accessible stores';
  RAISE NOTICE 'SECURITY: Store A can no longer see Store B items';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT: Run RLS integration tests to verify:';
  RAISE NOTICE '  npm test -- tests/integration/rls/';
END $$;
