-- Rollback Script: Safe cleanup of partial migration
-- Use this if migration 016 failed partway through
-- This is IDEMPOTENT - safe to run multiple times

-- ============================================================================
-- 1. Drop indexes that may have been created
-- ============================================================================

DROP INDEX IF EXISTS idx_inventory_items_store_name_unique;
DROP INDEX IF EXISTS idx_inventory_items_store_id;
DROP INDEX IF EXISTS idx_inventory_items_store_category;

-- ============================================================================
-- 2. Drop RLS policies that may have been created
-- ============================================================================

DROP POLICY IF EXISTS "inventory_items_select" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_insert" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_update" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_delete" ON inventory_items;

-- ============================================================================
-- 3. Remove store_id column if it exists
-- ============================================================================

-- First, check if we can safely remove it
DO $$
DECLARE
  items_with_store_id INTEGER;
  items_without_store_id INTEGER;
BEGIN
  SELECT COUNT(*) INTO items_with_store_id FROM inventory_items WHERE store_id IS NOT NULL;
  SELECT COUNT(*) INTO items_without_store_id FROM inventory_items WHERE store_id IS NULL;

  RAISE NOTICE 'Items with store_id: %', items_with_store_id;
  RAISE NOTICE 'Items without store_id: %', items_without_store_id;

  IF items_with_store_id > 0 AND items_without_store_id = 0 THEN
    RAISE EXCEPTION 'Migration appears complete. Do not rollback - use cleanup script instead.';
  END IF;
END $$;

-- Drop the column
ALTER TABLE inventory_items
DROP COLUMN IF EXISTS store_id;

RAISE NOTICE 'Rollback complete. Database is ready for fresh migration attempt.';
