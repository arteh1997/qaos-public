-- =====================================================
-- CLEANUP DUPLICATE RLS POLICIES
-- Restaurant Inventory Management System
--
-- Purpose: Remove old duplicate policies that weren't
-- dropped by the previous migration
-- =====================================================

-- STORES - Remove old policies, keep our new optimized ones
DROP POLICY IF EXISTS "Authenticated users can view stores" ON stores;
DROP POLICY IF EXISTS "Admins can insert stores" ON stores;
DROP POLICY IF EXISTS "Admins can update stores" ON stores;
DROP POLICY IF EXISTS "Admins can delete stores" ON stores;

-- PROFILES - Remove old policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can update any profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- INVENTORY_ITEMS - Remove old policies
DROP POLICY IF EXISTS "Authenticated users can view inventory items" ON inventory_items;
DROP POLICY IF EXISTS "Admins can insert inventory items" ON inventory_items;
DROP POLICY IF EXISTS "Admins can update inventory items" ON inventory_items;
DROP POLICY IF EXISTS "Admins can delete inventory items" ON inventory_items;

-- STORE_INVENTORY - Remove old policies
DROP POLICY IF EXISTS "Admin can manage all store inventory" ON store_inventory;
DROP POLICY IF EXISTS "Admins can view all store inventory" ON store_inventory;
DROP POLICY IF EXISTS "Admins can insert store inventory" ON store_inventory;
DROP POLICY IF EXISTS "Admins can update all store inventory" ON store_inventory;
DROP POLICY IF EXISTS "Staff can view own store inventory" ON store_inventory;
DROP POLICY IF EXISTS "Staff can insert own store inventory" ON store_inventory;
DROP POLICY IF EXISTS "Staff can update own store inventory" ON store_inventory;

-- STOCK_HISTORY - Remove old policies
DROP POLICY IF EXISTS "Admin can manage stock history" ON stock_history;
DROP POLICY IF EXISTS "Admins can view all stock history" ON stock_history;
DROP POLICY IF EXISTS "Admins can insert stock history" ON stock_history;
DROP POLICY IF EXISTS "Staff can view own store stock history" ON stock_history;
DROP POLICY IF EXISTS "Staff can insert own store stock history" ON stock_history;
DROP POLICY IF EXISTS "Staff can insert stock history for their store" ON stock_history;

-- DAILY_COUNTS - Remove old policies
DROP POLICY IF EXISTS "Admins can view all daily counts" ON daily_counts;
DROP POLICY IF EXISTS "Admins can insert daily counts" ON daily_counts;
DROP POLICY IF EXISTS "Admins can update daily counts" ON daily_counts;
DROP POLICY IF EXISTS "Staff can view own store daily counts" ON daily_counts;
DROP POLICY IF EXISTS "Staff can insert own store daily counts" ON daily_counts;

-- Remove duplicate index
DROP INDEX IF EXISTS idx_store_inventory_store_id;

-- Add missing indexes for foreign keys (suggestions)
CREATE INDEX IF NOT EXISTS idx_daily_counts_submitted_by
ON daily_counts(submitted_by);

CREATE INDEX IF NOT EXISTS idx_stock_history_inventory_item_id
ON stock_history(inventory_item_id);

CREATE INDEX IF NOT EXISTS idx_store_inventory_inventory_item_id
ON store_inventory(inventory_item_id);

CREATE INDEX IF NOT EXISTS idx_store_inventory_last_updated_by
ON store_inventory(last_updated_by);

-- Analyze tables after changes
ANALYZE stores;
ANALYZE profiles;
ANALYZE inventory_items;
ANALYZE store_inventory;
ANALYZE stock_history;
ANALYZE daily_counts;
ANALYZE shifts;
