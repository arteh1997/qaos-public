-- Cleanup Script: Remove duplicate items if migration created them
-- Use this if migration 016 completed but created duplicates
-- This keeps the OLDEST item and removes newer duplicates

-- ============================================================================
-- 1. Identify and log duplicates before removal
-- ============================================================================

DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO duplicate_count
  FROM (
    SELECT store_id, LOWER(name)
    FROM inventory_items
    WHERE is_active = true
    GROUP BY store_id, LOWER(name)
    HAVING COUNT(*) > 1
  ) dupes;

  RAISE NOTICE 'Found % duplicate item name(s) across stores', duplicate_count;
END $$;

-- ============================================================================
-- 2. Create temp table with duplicates to keep (oldest items)
-- ============================================================================

CREATE TEMP TABLE items_to_keep AS
SELECT DISTINCT ON (store_id, LOWER(name))
  id,
  store_id,
  name,
  created_at
FROM inventory_items
WHERE is_active = true
  AND store_id IS NOT NULL
ORDER BY store_id, LOWER(name), created_at ASC;

-- ============================================================================
-- 3. Create temp table with duplicates to remove (newer items)
-- ============================================================================

CREATE TEMP TABLE items_to_remove AS
SELECT ii.id, ii.store_id, ii.name, ii.created_at
FROM inventory_items ii
WHERE ii.is_active = true
  AND ii.store_id IS NOT NULL
  AND ii.id NOT IN (SELECT id FROM items_to_keep)
  AND EXISTS (
    -- Only remove if there's an older item with same (store_id, name)
    SELECT 1 FROM items_to_keep itk
    WHERE itk.store_id = ii.store_id
      AND LOWER(itk.name) = LOWER(ii.name)
  );

-- ============================================================================
-- 4. Update references to point to kept items
-- ============================================================================

-- Update store_inventory references
WITH remap AS (
  SELECT
    itr.id as old_id,
    itk.id as new_id
  FROM items_to_remove itr
  JOIN items_to_keep itk ON
    itk.store_id = itr.store_id
    AND LOWER(itk.name) = LOWER(itr.name)
)
UPDATE store_inventory si
SET inventory_item_id = remap.new_id
FROM remap
WHERE si.inventory_item_id = remap.old_id;

-- Update stock_history references
WITH remap AS (
  SELECT
    itr.id as old_id,
    itk.id as new_id
  FROM items_to_remove itr
  JOIN items_to_keep itk ON
    itk.store_id = itr.store_id
    AND LOWER(itk.name) = LOWER(itr.name)
)
UPDATE stock_history sh
SET inventory_item_id = remap.new_id
FROM remap
WHERE sh.inventory_item_id = remap.old_id;

-- ============================================================================
-- 5. Delete duplicate items
-- ============================================================================

DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM inventory_items
  WHERE id IN (SELECT id FROM items_to_remove);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % duplicate item(s)', deleted_count;
END $$;

-- ============================================================================
-- 6. Verify cleanup
-- ============================================================================

DO $$
DECLARE
  remaining_duplicates INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO remaining_duplicates
  FROM (
    SELECT store_id, LOWER(name)
    FROM inventory_items
    WHERE is_active = true AND store_id IS NOT NULL
    GROUP BY store_id, LOWER(name)
    HAVING COUNT(*) > 1
  ) dupes;

  IF remaining_duplicates > 0 THEN
    RAISE EXCEPTION 'Cleanup failed: % duplicates still remain', remaining_duplicates;
  ELSE
    RAISE NOTICE 'Cleanup successful: No duplicates remain';
  END IF;
END $$;

-- ============================================================================
-- 7. Now create the unique index (should succeed)
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_store_name_unique
ON inventory_items(store_id, LOWER(name))
WHERE is_active = true;

RAISE NOTICE 'Unique index created successfully';
