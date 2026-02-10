-- Migration: Add store_id to inventory_items for multi-tenant isolation (FIXED)
-- Description: Converts inventory_items from global catalog to store-specific items
--              This prevents cross-tenant data leakage where Store A could see Store B's items.
--
-- FIX: Handles duplicate items by ensuring only ONE item per (store_id, name) combination
--
-- ============================================================================
-- 1. Add store_id column to inventory_items (nullable for now)
-- ============================================================================

ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

COMMENT ON COLUMN inventory_items.store_id IS
  'Store that owns this inventory item. After migration, this becomes NOT NULL for true multi-tenancy.';

-- ============================================================================
-- 2. Data Migration: Create store-specific items (handles duplicates)
-- ============================================================================

-- Step 1: Create mapping of what items each store needs
-- Group by (store_id, name, category, unit_of_measure) to avoid duplicates
CREATE TEMP TABLE items_needed AS
SELECT DISTINCT
  si.store_id,
  ii.name,
  ii.category,
  ii.unit_of_measure,
  ii.is_active,
  MIN(ii.created_at) as created_at,
  MAX(ii.updated_at) as updated_at,
  -- Track the first inventory_item_id we encounter for this combination
  (ARRAY_AGG(si.inventory_item_id ORDER BY ii.created_at))[1] as original_item_id
FROM store_inventory si
JOIN inventory_items ii ON ii.id = si.inventory_item_id
WHERE ii.store_id IS NULL  -- Only migrate items that don't have store_id yet
GROUP BY si.store_id, ii.name, ii.category, ii.unit_of_measure, ii.is_active;

-- Step 2: Create new store-specific items
CREATE TEMP TABLE new_items_map AS
WITH inserted_items AS (
  INSERT INTO inventory_items (id, store_id, name, category, unit_of_measure, is_active, created_at, updated_at)
  SELECT
    gen_random_uuid() as id,
    store_id,
    name,
    category,
    unit_of_measure,
    is_active,
    created_at,
    updated_at
  FROM items_needed
  RETURNING id, store_id, name, category, unit_of_measure
)
SELECT
  ineed.original_item_id as old_item_id,
  ins.id as new_item_id,
  ins.store_id
FROM items_needed ineed
JOIN inserted_items ins ON
  ins.store_id = ineed.store_id
  AND ins.name = ineed.name
  AND ins.category IS NOT DISTINCT FROM ineed.category
  AND ins.unit_of_measure = ineed.unit_of_measure;

-- Step 3: Create complete mapping for ALL old items to new items
-- (handles cases where multiple old_item_ids should map to same new item)
CREATE TEMP TABLE complete_item_map AS
SELECT DISTINCT
  si.inventory_item_id as old_item_id,
  nim.new_item_id,
  si.store_id
FROM store_inventory si
JOIN inventory_items ii ON ii.id = si.inventory_item_id
JOIN new_items_map nim ON
  nim.store_id = si.store_id
  AND nim.old_item_id IN (
    -- Find any old item with same (name, category, unit) as this one
    SELECT ii2.id
    FROM inventory_items ii2
    WHERE ii2.name = ii.name
      AND ii2.category IS NOT DISTINCT FROM ii.category
      AND ii2.unit_of_measure = ii.unit_of_measure
      AND ii2.store_id IS NULL
  )
WHERE ii.store_id IS NULL;

-- Step 4: Update store_inventory to reference new store-specific items
UPDATE store_inventory si
SET inventory_item_id = cim.new_item_id
FROM complete_item_map cim
WHERE si.inventory_item_id = cim.old_item_id
  AND si.store_id = cim.store_id;

-- Step 5: Update stock_history to reference new store-specific items
UPDATE stock_history sh
SET inventory_item_id = cim.new_item_id
FROM complete_item_map cim
WHERE sh.inventory_item_id = cim.old_item_id
  AND sh.store_id = cim.store_id;

-- Step 6: Delete old global inventory_items (no longer referenced)
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
DROP INDEX IF EXISTS idx_inventory_items_store_name_unique;
CREATE UNIQUE INDEX idx_inventory_items_store_name_unique
ON inventory_items(store_id, LOWER(name))
WHERE is_active = true;

COMMENT ON INDEX idx_inventory_items_store_name_unique IS
  'Prevents duplicate item names within the same store (case-insensitive).
   Different stores can have items with the same name.';

-- Add indexes for efficient queries
DROP INDEX IF EXISTS idx_inventory_items_store_id;
DROP INDEX IF EXISTS idx_inventory_items_store_category;

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
-- 5. Migration Summary
-- ============================================================================

DO $$
DECLARE
  item_count INTEGER;
  store_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO item_count FROM inventory_items;
  SELECT COUNT(DISTINCT store_id) INTO store_count FROM inventory_items;

  RAISE NOTICE '=== Migration 016 Complete (FIXED) ===';
  RAISE NOTICE 'Total inventory items: %', item_count;
  RAISE NOTICE 'Total stores with items: %', store_count;
  RAISE NOTICE 'Multi-tenant isolation: ENABLED';
  RAISE NOTICE 'Store-specific items: All items now scoped to stores';
  RAISE NOTICE '';
  RAISE NOTICE 'Verification: Run this query to check for issues:';
  RAISE NOTICE 'SELECT COUNT(*) FROM inventory_items WHERE store_id IS NULL; -- Should be 0';
END $$;
