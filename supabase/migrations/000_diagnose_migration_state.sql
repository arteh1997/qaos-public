-- Diagnostic Script: Check current state of inventory_items migration
-- Run this FIRST before attempting any fixes

-- 1. Check if store_id column exists
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'inventory_items'
  AND column_name = 'store_id';

-- 2. Check how many items have store_id vs NULL
SELECT
  CASE
    WHEN store_id IS NULL THEN 'NULL (not migrated)'
    ELSE 'Has store_id (migrated)'
  END as migration_status,
  COUNT(*) as count
FROM inventory_items
GROUP BY
  CASE
    WHEN store_id IS NULL THEN 'NULL (not migrated)'
    ELSE 'Has store_id (migrated)'
  END;

-- 3. Check for duplicate items within same store
SELECT
  store_id,
  LOWER(name) as name_lower,
  COUNT(*) as duplicate_count,
  STRING_AGG(id::text, ', ') as item_ids
FROM inventory_items
WHERE store_id IS NOT NULL
  AND is_active = true
GROUP BY store_id, LOWER(name)
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 4. Check current indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'inventory_items'
  AND indexname LIKE '%store%';

-- 5. Check RLS policies
SELECT
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'inventory_items'
ORDER BY policyname;
