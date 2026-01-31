-- =====================================================
-- RLS PERFORMANCE FIX MIGRATION
-- Restaurant Inventory Management System
--
-- Purpose: Fix RLS policies to use (select auth.uid()) pattern
-- instead of auth.uid() to prevent per-row re-evaluation
--
-- This fixes 105 performance warnings from Supabase linter
-- =====================================================

-- =====================================================
-- SECTION 1: DROP ALL EXISTING RLS POLICIES
-- =====================================================

-- Stores policies
DROP POLICY IF EXISTS "Admin and Driver can view all stores" ON stores;
DROP POLICY IF EXISTS "Staff can view their assigned store" ON stores;
DROP POLICY IF EXISTS "Users can view stores" ON stores;
DROP POLICY IF EXISTS "Admin can manage stores" ON stores;

-- Profiles policies
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Driver can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Staff can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

-- Inventory items policies
DROP POLICY IF EXISTS "All authenticated users can view inventory items" ON inventory_items;
DROP POLICY IF EXISTS "Users can view inventory items" ON inventory_items;
DROP POLICY IF EXISTS "Admin can manage inventory items" ON inventory_items;

-- Store inventory policies
DROP POLICY IF EXISTS "Admin and Driver can view all store inventory" ON store_inventory;
DROP POLICY IF EXISTS "Staff can view their store inventory" ON store_inventory;
DROP POLICY IF EXISTS "Driver can insert/update store inventory" ON store_inventory;
DROP POLICY IF EXISTS "Driver can update store inventory" ON store_inventory;
DROP POLICY IF EXISTS "Staff can insert their store inventory" ON store_inventory;
DROP POLICY IF EXISTS "Users can view store inventory" ON store_inventory;
DROP POLICY IF EXISTS "Admin can manage store inventory" ON store_inventory;
DROP POLICY IF EXISTS "Staff can update their store inventory" ON store_inventory;

-- Stock history policies
DROP POLICY IF EXISTS "Admin and Driver can view all stock history" ON stock_history;
DROP POLICY IF EXISTS "Staff can view their store stock history" ON stock_history;
DROP POLICY IF EXISTS "Driver can insert stock history" ON stock_history;
DROP POLICY IF EXISTS "Staff can insert their store stock history" ON stock_history;
DROP POLICY IF EXISTS "Users can view stock history for their store" ON stock_history;
DROP POLICY IF EXISTS "Users can insert stock history for their store" ON stock_history;
DROP POLICY IF EXISTS "Admins can do everything with stock_history" ON stock_history;
DROP POLICY IF EXISTS "Users can view stock history" ON stock_history;

-- Daily counts policies
DROP POLICY IF EXISTS "Admin and Driver can view all daily counts" ON daily_counts;
DROP POLICY IF EXISTS "Staff can view their store daily counts" ON daily_counts;
DROP POLICY IF EXISTS "Driver can insert daily counts" ON daily_counts;
DROP POLICY IF EXISTS "Staff can insert their store daily counts" ON daily_counts;
DROP POLICY IF EXISTS "Users can view daily counts for their store" ON daily_counts;
DROP POLICY IF EXISTS "Staff can insert daily counts for their store" ON daily_counts;
DROP POLICY IF EXISTS "Admins can do everything with daily_counts" ON daily_counts;
DROP POLICY IF EXISTS "Admin can manage daily counts" ON daily_counts;
DROP POLICY IF EXISTS "Staff can manage their store daily counts" ON daily_counts;
DROP POLICY IF EXISTS "Users can view daily counts" ON daily_counts;

-- Shifts policies
DROP POLICY IF EXISTS "select_shifts" ON shifts;
DROP POLICY IF EXISTS "insert_shifts" ON shifts;
DROP POLICY IF EXISTS "update_shifts" ON shifts;
DROP POLICY IF EXISTS "delete_shifts" ON shifts;


-- =====================================================
-- SECTION 2: HELPER FUNCTIONS WITH FIXED SEARCH PATH
-- =====================================================

-- Drop ALL versions of these functions (with any signature)
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all versions of get_user_role
    FOR r IN SELECT oid::regprocedure AS func_signature
             FROM pg_proc
             WHERE proname = 'get_user_role' AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
    END LOOP;

    -- Drop all versions of get_user_store_id
    FOR r IN SELECT oid::regprocedure AS func_signature
             FROM pg_proc
             WHERE proname = 'get_user_store_id' AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
    END LOOP;
END $$;

-- Get user role (with fixed search_path)
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT FROM profiles WHERE id = (select auth.uid());
$$;

-- Get user store_id (with fixed search_path)
CREATE OR REPLACE FUNCTION get_user_store_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM profiles WHERE id = (select auth.uid());
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_store_id TO authenticated;


-- =====================================================
-- SECTION 3: RECREATE RLS POLICIES WITH OPTIMIZED PATTERN
-- Using (select auth.uid()) instead of auth.uid()
-- =====================================================

-- -----------------------------------------------------
-- STORES TABLE
-- -----------------------------------------------------
CREATE POLICY "stores_select_policy" ON stores
  FOR SELECT TO authenticated
  USING (
    (select get_user_role()) IN ('Admin', 'Driver')
    OR id = (select get_user_store_id())
  );

CREATE POLICY "stores_insert_policy" ON stores
  FOR INSERT TO authenticated
  WITH CHECK ((select get_user_role()) = 'Admin');

CREATE POLICY "stores_update_policy" ON stores
  FOR UPDATE TO authenticated
  USING ((select get_user_role()) = 'Admin')
  WITH CHECK ((select get_user_role()) = 'Admin');

CREATE POLICY "stores_delete_policy" ON stores
  FOR DELETE TO authenticated
  USING ((select get_user_role()) = 'Admin');


-- -----------------------------------------------------
-- PROFILES TABLE
-- -----------------------------------------------------
CREATE POLICY "profiles_select_policy" ON profiles
  FOR SELECT TO authenticated
  USING (
    (select get_user_role()) IN ('Admin', 'Driver')
    OR id = (select auth.uid())
  );

CREATE POLICY "profiles_insert_policy" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK ((select get_user_role()) = 'Admin');

CREATE POLICY "profiles_update_policy" ON profiles
  FOR UPDATE TO authenticated
  USING (
    (select get_user_role()) = 'Admin'
    OR id = (select auth.uid())
  )
  WITH CHECK (
    (select get_user_role()) = 'Admin'
    OR id = (select auth.uid())
  );

CREATE POLICY "profiles_delete_policy" ON profiles
  FOR DELETE TO authenticated
  USING ((select get_user_role()) = 'Admin');


-- -----------------------------------------------------
-- INVENTORY ITEMS TABLE
-- -----------------------------------------------------
CREATE POLICY "inventory_items_select_policy" ON inventory_items
  FOR SELECT TO authenticated
  USING (true);  -- All authenticated users can view

CREATE POLICY "inventory_items_insert_policy" ON inventory_items
  FOR INSERT TO authenticated
  WITH CHECK ((select get_user_role()) = 'Admin');

CREATE POLICY "inventory_items_update_policy" ON inventory_items
  FOR UPDATE TO authenticated
  USING ((select get_user_role()) = 'Admin')
  WITH CHECK ((select get_user_role()) = 'Admin');

CREATE POLICY "inventory_items_delete_policy" ON inventory_items
  FOR DELETE TO authenticated
  USING ((select get_user_role()) = 'Admin');


-- -----------------------------------------------------
-- STORE INVENTORY TABLE
-- -----------------------------------------------------
CREATE POLICY "store_inventory_select_policy" ON store_inventory
  FOR SELECT TO authenticated
  USING (
    (select get_user_role()) IN ('Admin', 'Driver')
    OR store_id = (select get_user_store_id())
  );

CREATE POLICY "store_inventory_insert_policy" ON store_inventory
  FOR INSERT TO authenticated
  WITH CHECK (
    (select get_user_role()) IN ('Admin', 'Driver')
    OR store_id = (select get_user_store_id())
  );

CREATE POLICY "store_inventory_update_policy" ON store_inventory
  FOR UPDATE TO authenticated
  USING (
    (select get_user_role()) IN ('Admin', 'Driver')
    OR store_id = (select get_user_store_id())
  )
  WITH CHECK (
    (select get_user_role()) IN ('Admin', 'Driver')
    OR store_id = (select get_user_store_id())
  );

CREATE POLICY "store_inventory_delete_policy" ON store_inventory
  FOR DELETE TO authenticated
  USING ((select get_user_role()) = 'Admin');


-- -----------------------------------------------------
-- STOCK HISTORY TABLE
-- -----------------------------------------------------
CREATE POLICY "stock_history_select_policy" ON stock_history
  FOR SELECT TO authenticated
  USING (
    (select get_user_role()) IN ('Admin', 'Driver')
    OR store_id = (select get_user_store_id())
  );

CREATE POLICY "stock_history_insert_policy" ON stock_history
  FOR INSERT TO authenticated
  WITH CHECK (
    (select get_user_role()) IN ('Admin', 'Driver')
    OR store_id = (select get_user_store_id())
  );

-- Stock history should be immutable (no updates/deletes except admin)
CREATE POLICY "stock_history_update_policy" ON stock_history
  FOR UPDATE TO authenticated
  USING ((select get_user_role()) = 'Admin')
  WITH CHECK ((select get_user_role()) = 'Admin');

CREATE POLICY "stock_history_delete_policy" ON stock_history
  FOR DELETE TO authenticated
  USING ((select get_user_role()) = 'Admin');


-- -----------------------------------------------------
-- DAILY COUNTS TABLE
-- -----------------------------------------------------
CREATE POLICY "daily_counts_select_policy" ON daily_counts
  FOR SELECT TO authenticated
  USING (
    (select get_user_role()) IN ('Admin', 'Driver')
    OR store_id = (select get_user_store_id())
  );

CREATE POLICY "daily_counts_insert_policy" ON daily_counts
  FOR INSERT TO authenticated
  WITH CHECK (
    (select get_user_role()) IN ('Admin', 'Driver')
    OR store_id = (select get_user_store_id())
  );

CREATE POLICY "daily_counts_update_policy" ON daily_counts
  FOR UPDATE TO authenticated
  USING (
    (select get_user_role()) IN ('Admin', 'Driver')
    OR store_id = (select get_user_store_id())
  )
  WITH CHECK (
    (select get_user_role()) IN ('Admin', 'Driver')
    OR store_id = (select get_user_store_id())
  );

CREATE POLICY "daily_counts_delete_policy" ON daily_counts
  FOR DELETE TO authenticated
  USING ((select get_user_role()) = 'Admin');


-- -----------------------------------------------------
-- SHIFTS TABLE
-- -----------------------------------------------------
CREATE POLICY "shifts_select_policy" ON shifts
  FOR SELECT TO authenticated
  USING (
    (select get_user_role()) = 'Admin'
    OR user_id = (select auth.uid())
    OR store_id = (select get_user_store_id())
  );

CREATE POLICY "shifts_insert_policy" ON shifts
  FOR INSERT TO authenticated
  WITH CHECK ((select get_user_role()) = 'Admin');

CREATE POLICY "shifts_update_policy" ON shifts
  FOR UPDATE TO authenticated
  USING (
    (select get_user_role()) = 'Admin'
    OR user_id = (select auth.uid())
  )
  WITH CHECK (
    (select get_user_role()) = 'Admin'
    OR user_id = (select auth.uid())
  );

CREATE POLICY "shifts_delete_policy" ON shifts
  FOR DELETE TO authenticated
  USING ((select get_user_role()) = 'Admin');


-- =====================================================
-- SECTION 4: FIX FUNCTION SEARCH PATHS
-- =====================================================

-- Fix get_missing_counts
CREATE OR REPLACE FUNCTION get_missing_counts(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
    store_id UUID,
    store_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.name::TEXT
    FROM stores s
    LEFT JOIN daily_counts dc
        ON dc.store_id = s.id
        AND dc.count_date = target_date
    WHERE s.is_active = true
      AND dc.id IS NULL
    ORDER BY s.name;
END;
$$;

-- Fix check_shift_overlap
CREATE OR REPLACE FUNCTION check_shift_overlap(
    p_user_id UUID,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_exclude_shift_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM shifts
        WHERE user_id = p_user_id
          AND (p_exclude_shift_id IS NULL OR id != p_exclude_shift_id)
          AND start_time < p_end_time
          AND end_time > p_start_time
    );
END;
$$;

-- Fix get_low_stock_items
CREATE OR REPLACE FUNCTION get_low_stock_items(p_store_id UUID DEFAULT NULL)
RETURNS TABLE(
    store_id UUID,
    store_name TEXT,
    inventory_item_id UUID,
    item_name TEXT,
    unit_of_measure TEXT,
    current_quantity NUMERIC,
    par_level NUMERIC,
    shortage NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        si.store_id,
        s.name::TEXT AS store_name,
        si.inventory_item_id,
        i.name::TEXT AS item_name,
        i.unit_of_measure::TEXT,
        si.quantity AS current_quantity,
        si.par_level,
        (si.par_level - si.quantity) AS shortage
    FROM store_inventory si
    INNER JOIN stores s ON s.id = si.store_id
    INNER JOIN inventory_items i ON i.id = si.inventory_item_id
    WHERE si.par_level IS NOT NULL
      AND si.quantity < si.par_level
      AND s.is_active = true
      AND i.is_active = true
      AND (p_store_id IS NULL OR si.store_id = p_store_id)
    ORDER BY (si.par_level - si.quantity) DESC;
END;
$$;

-- Fix get_stock_history
CREATE OR REPLACE FUNCTION get_stock_history(
    p_store_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_action_type TEXT DEFAULT NULL,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    store_id UUID,
    store_name TEXT,
    inventory_item_id UUID,
    item_name TEXT,
    action_type TEXT,
    quantity_before NUMERIC,
    quantity_after NUMERIC,
    quantity_change NUMERIC,
    performed_by UUID,
    performer_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sh.id,
        sh.store_id,
        s.name::TEXT AS store_name,
        sh.inventory_item_id,
        i.name::TEXT AS item_name,
        sh.action_type::TEXT,
        sh.quantity_before,
        sh.quantity_after,
        sh.quantity_change,
        sh.performed_by,
        p.full_name::TEXT AS performer_name,
        sh.notes::TEXT,
        sh.created_at
    FROM stock_history sh
    INNER JOIN stores s ON s.id = sh.store_id
    INNER JOIN inventory_items i ON i.id = sh.inventory_item_id
    LEFT JOIN profiles p ON p.id = sh.performed_by
    WHERE (p_store_id IS NULL OR sh.store_id = p_store_id)
      AND (p_start_date IS NULL OR sh.created_at >= p_start_date)
      AND (p_end_date IS NULL OR sh.created_at < (p_end_date + INTERVAL '1 day'))
      AND (p_action_type IS NULL OR sh.action_type::TEXT = p_action_type)
    ORDER BY sh.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Fix get_daily_summary
CREATE OR REPLACE FUNCTION get_daily_summary(
    p_date DATE DEFAULT CURRENT_DATE,
    p_store_id UUID DEFAULT NULL
)
RETURNS TABLE(
    total_counts BIGINT,
    total_receptions BIGINT,
    total_adjustments BIGINT,
    stores_counted BIGINT,
    total_active_stores BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH history_stats AS (
        SELECT
            COUNT(*) FILTER (WHERE action_type = 'Count') AS count_actions,
            COUNT(*) FILTER (WHERE action_type = 'Reception') AS reception_actions,
            COUNT(*) FILTER (WHERE action_type = 'Adjustment') AS adjustment_actions
        FROM stock_history
        WHERE created_at >= p_date
          AND created_at < (p_date + INTERVAL '1 day')
          AND (p_store_id IS NULL OR stock_history.store_id = p_store_id)
    ),
    count_stats AS (
        SELECT COUNT(DISTINCT dc.store_id) AS stores_counted
        FROM daily_counts dc
        WHERE dc.count_date = p_date
          AND (p_store_id IS NULL OR dc.store_id = p_store_id)
    ),
    store_stats AS (
        SELECT COUNT(*) AS total_stores
        FROM stores
        WHERE is_active = true
          AND (p_store_id IS NULL OR stores.id = p_store_id)
    )
    SELECT
        h.count_actions,
        h.reception_actions,
        h.adjustment_actions,
        c.stores_counted,
        s.total_stores
    FROM history_stats h, count_stats c, store_stats s;
END;
$$;

-- Grant execute permissions on all functions
GRANT EXECUTE ON FUNCTION get_missing_counts TO authenticated;
GRANT EXECUTE ON FUNCTION check_shift_overlap TO authenticated;
GRANT EXECUTE ON FUNCTION get_low_stock_items TO authenticated;
GRANT EXECUTE ON FUNCTION get_stock_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_summary TO authenticated;


-- =====================================================
-- SECTION 5: VERIFY AND ANALYZE
-- =====================================================

-- Analyze tables to update statistics
ANALYZE stores;
ANALYZE profiles;
ANALYZE inventory_items;
ANALYZE store_inventory;
ANALYZE stock_history;
ANALYZE shifts;
ANALYZE daily_counts;

-- Comments for documentation
COMMENT ON POLICY "stores_select_policy" ON stores IS 'Optimized: Admin/Driver see all, Staff see their store only';
COMMENT ON POLICY "profiles_select_policy" ON profiles IS 'Optimized: Admin/Driver see all, users see own profile';
COMMENT ON POLICY "store_inventory_select_policy" ON store_inventory IS 'Optimized: Admin/Driver see all, Staff see their store only';
COMMENT ON POLICY "shifts_select_policy" ON shifts IS 'Optimized: Admin sees all, users see their own shifts';
