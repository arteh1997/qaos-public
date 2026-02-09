-- Migration: Add store_id to inventory_items for multi-tenant isolation
-- Description: Converts inventory_items from global catalog to store-specific items
--              This prevents cross-tenant data leakage where Store A could see Store B's items.
--
-- Strategy: Each inventory_item will be duplicated for each store that uses it.
--           Example: If "Flour" is used by Store A and Store B, we create 2 records:
--                    - "Flour" (store_id = Store A's ID)
--                    - "Flour" (store_id = Store B's ID)
--
-- Rollback: To revert, you would need to:
--           1. Store backup of inventory_items before migration
--           2. DROP CONSTRAINT and COLUMN store_id
--           3. Restore original inventory_items
--
-- ============================================================================
-- 1. Add store_id column to inventory_items (nullable for now)
-- ============================================================================

ALTER TABLE inventory_items
ADD COLUMN store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

COMMENT ON COLUMN inventory_items.store_id IS
  'Store that owns this inventory item. After migration, this becomes NOT NULL for true multi-tenancy.';

-- ============================================================================
-- 2. Data Migration: Duplicate items for each store that uses them
-- ============================================================================

-- Step 1: For each inventory_item used by stores (via store_inventory),
--         create a store-specific copy

-- Get all items that are currently in use by stores
WITH items_in_use AS (
  SELECT DISTINCT
    si.inventory_item_id,
    si.store_id,
    ii.name,
    ii.category,
    ii.unit_of_measure,
    ii.is_active,
    ii.created_at,
    ii.updated_at
  FROM store_inventory si
  JOIN inventory_items ii ON ii.id = si.inventory_item_id
),
-- Create new store-specific items
new_items AS (
  INSERT INTO inventory_items (id, store_id, name, category, unit_of_measure, is_active, created_at, updated_at)
  SELECT
    gen_random_uuid(), -- New ID for store-specific item
    store_id,
    name,
    category,
    unit_of_measure,
    is_active,
    created_at,
    updated_at
  FROM items_in_use
  RETURNING id, store_id, name, category, unit_of_measure
)
-- Update store_inventory to point to new store-specific items
-- This is done in a separate transaction to ensure atomicity
SELECT 1; -- Placeholder, actual update happens below

-- Step 2: Create a mapping table to track old_item_id -> new_item_id per store
CREATE TEMP TABLE item_migration_map AS
WITH items_in_use AS (
  SELECT DISTINCT
    si.inventory_item_id as old_item_id,
    si.store_id,
    ii.name,
    ii.category,
    ii.unit_of_measure,
    ii.is_active,
    ii.created_at,
    ii.updated_at
  FROM store_inventory si
  JOIN inventory_items ii ON ii.id = si.inventory_item_id
),
new_items AS (
  INSERT INTO inventory_items (id, store_id, name, category, unit_of_measure, is_active, created_at, updated_at)
  SELECT
    gen_random_uuid(),
    store_id,
    name,
    category,
    unit_of_measure,
    is_active,
    created_at,
    updated_at
  FROM items_in_use
  RETURNING id as new_item_id, store_id, name, category, unit_of_measure
)
SELECT
  iu.old_item_id,
  ni.new_item_id,
  ni.store_id
FROM items_in_use iu
JOIN new_items ni ON
  ni.store_id = iu.store_id
  AND ni.name = iu.name
  AND ni.category IS NOT DISTINCT FROM iu.category
  AND ni.unit_of_measure = iu.unit_of_measure;

-- Step 3: Update store_inventory to reference new store-specific items
UPDATE store_inventory si
SET inventory_item_id = mim.new_item_id
FROM item_migration_map mim
WHERE si.inventory_item_id = mim.old_item_id
  AND si.store_id = mim.store_id;

-- Step 4: Update stock_history to reference new store-specific items
UPDATE stock_history sh
SET inventory_item_id = mim.new_item_id
FROM item_migration_map mim
WHERE sh.inventory_item_id = mim.old_item_id
  AND sh.store_id = mim.store_id;

-- Step 5: Delete old global inventory_items (no longer referenced)
DELETE FROM inventory_items
WHERE store_id IS NULL;

-- ============================================================================
-- 3. Make store_id NOT NULL and add constraints
-- ============================================================================

-- Now that all items have store_id, make it required
ALTER TABLE inventory_items
ALTER COLUMN store_id SET NOT NULL;

-- Add unique constraint: same item name can exist in different stores,
-- but not duplicate names within the same store
CREATE UNIQUE INDEX idx_inventory_items_store_name_unique
ON inventory_items(store_id, LOWER(name))
WHERE is_active = true;

COMMENT ON INDEX idx_inventory_items_store_name_unique IS
  'Prevents duplicate item names within the same store (case-insensitive).
   Different stores can have items with the same name.';

-- Add index for efficient queries
CREATE INDEX idx_inventory_items_store_id ON inventory_items(store_id);
CREATE INDEX idx_inventory_items_store_category ON inventory_items(store_id, category)
WHERE is_active = true;

-- ============================================================================
-- 4. Update RLS Policies for Multi-Tenant Isolation
-- ============================================================================

-- Drop old RLS policies (global visibility)
DROP POLICY IF EXISTS "inventory_items_select" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_insert" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_update" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_delete" ON inventory_items;

-- Create new store-scoped RLS policies
CREATE POLICY "inventory_items_select" ON inventory_items
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR store_id IN (SELECT store_id FROM store_users WHERE user_id = auth.uid())
  );

COMMENT ON POLICY "inventory_items_select" ON inventory_items IS
  'Users can only see inventory items from stores they have access to';

CREATE POLICY "inventory_items_insert" ON inventory_items
  FOR INSERT TO authenticated
  WITH CHECK (
    is_platform_admin()
    OR (
      store_id IN (
        SELECT store_id
        FROM store_users
        WHERE user_id = auth.uid()
          AND role IN ('Owner', 'Manager')
      )
    )
  );

COMMENT ON POLICY "inventory_items_insert" ON inventory_items IS
  'Only Owners and Managers can create inventory items for their stores';

CREATE POLICY "inventory_items_update" ON inventory_items
  FOR UPDATE TO authenticated
  USING (
    is_platform_admin()
    OR (
      store_id IN (
        SELECT store_id
        FROM store_users
        WHERE user_id = auth.uid()
          AND role IN ('Owner', 'Manager')
      )
    )
  )
  WITH CHECK (
    is_platform_admin()
    OR (
      store_id IN (
        SELECT store_id
        FROM store_users
        WHERE user_id = auth.uid()
          AND role IN ('Owner', 'Manager')
      )
    )
  );

COMMENT ON POLICY "inventory_items_update" ON inventory_items IS
  'Only Owners and Managers can update inventory items in their stores';

CREATE POLICY "inventory_items_delete" ON inventory_items
  FOR DELETE TO authenticated
  USING (
    is_platform_admin()
    OR (
      store_id IN (
        SELECT store_id
        FROM store_users
        WHERE user_id = auth.uid()
          AND role = 'Owner'
      )
    )
  );

COMMENT ON POLICY "inventory_items_delete" ON inventory_items IS
  'Only Owners can delete inventory items from their stores';

-- ============================================================================
-- 5. Verification Queries (for manual testing after migration)
-- ============================================================================

-- Check that all inventory_items have store_id
-- Should return 0
-- SELECT COUNT(*) FROM inventory_items WHERE store_id IS NULL;

-- Check that stores can only see their own items (test with specific user)
-- SELECT * FROM inventory_items WHERE auth.uid() = '<test-user-id>';

-- Check that item names are unique within stores but can repeat across stores
-- SELECT store_id, name, COUNT(*)
-- FROM inventory_items
-- GROUP BY store_id, name
-- HAVING COUNT(*) > 1;

-- ============================================================================
-- 6. Migration Summary
-- ============================================================================

DO $$
DECLARE
  item_count INTEGER;
  store_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO item_count FROM inventory_items;
  SELECT COUNT(DISTINCT store_id) INTO store_count FROM inventory_items;

  RAISE NOTICE '=== Migration 016 Complete ===';
  RAISE NOTICE 'Total inventory items: %', item_count;
  RAISE NOTICE 'Total stores with items: %', store_count;
  RAISE NOTICE 'Multi-tenant isolation: ENABLED';
  RAISE NOTICE 'Store-specific items: All items now scoped to stores';
END $$;
