-- =====================================================
-- DATABASE OPTIMIZATION MIGRATION
-- Restaurant Inventory Management System
--
-- Purpose: Add performance indexes and optimized functions
-- Run Time: ~2-5 minutes (varies with data volume)
-- Safe: Uses IF NOT EXISTS, idempotent
-- =====================================================

-- =====================================================
-- SECTION 1: PERFORMANCE INDEXES
-- =====================================================

-- -----------------------------------------------------
-- Stock History Indexes (Highest Priority)
-- This table grows fastest and is queried frequently
-- -----------------------------------------------------

-- Primary query pattern: Filter by store, order by date
-- Used by: Daily summary, stock history views, reports
CREATE INDEX IF NOT EXISTS idx_stock_history_store_created
ON stock_history(store_id, created_at DESC);

-- Secondary pattern: Filter by action type (Count, Reception, Adjustment)
-- Used by: Action-specific reports and filtering
CREATE INDEX IF NOT EXISTS idx_stock_history_action_created
ON stock_history(action_type, created_at DESC);

-- Audit trail: Find actions by performer
-- Used by: User activity reports, audit logs
CREATE INDEX IF NOT EXISTS idx_stock_history_performed_by
ON stock_history(performed_by)
WHERE performed_by IS NOT NULL;

-- Composite for detailed history queries
-- Used by: Store-specific action history
CREATE INDEX IF NOT EXISTS idx_stock_history_store_action_created
ON stock_history(store_id, action_type, created_at DESC);

-- -----------------------------------------------------
-- Store Inventory Indexes
-- Core operational table for inventory management
-- -----------------------------------------------------

-- Primary pattern: Get all inventory for a store
-- Used by: Store inventory page, stock counts
CREATE INDEX IF NOT EXISTS idx_store_inventory_store
ON store_inventory(store_id);

-- Combined with quantity for sorting/filtering
-- Used by: Low stock detection, inventory reports
CREATE INDEX IF NOT EXISTS idx_store_inventory_store_quantity
ON store_inventory(store_id, quantity);

-- Partial index for low stock items only
-- Used by: Low stock alerts and reports (high frequency)
CREATE INDEX IF NOT EXISTS idx_store_inventory_low_stock
ON store_inventory(store_id, inventory_item_id, quantity, par_level)
WHERE par_level IS NOT NULL;

-- -----------------------------------------------------
-- Shifts Indexes
-- Schedule management and time tracking
-- -----------------------------------------------------

-- Primary pattern: User's shifts with time range
-- Used by: My Shifts page, overlap detection
CREATE INDEX IF NOT EXISTS idx_shifts_user_time
ON shifts(user_id, start_time, end_time);

-- Store schedule view
-- Used by: Store schedule page, admin views
CREATE INDEX IF NOT EXISTS idx_shifts_store_time
ON shifts(store_id, start_time DESC);

-- Active shifts (not clocked out)
-- Used by: Currently working staff queries
CREATE INDEX IF NOT EXISTS idx_shifts_active
ON shifts(store_id, user_id)
WHERE clock_in_time IS NOT NULL AND clock_out_time IS NULL;

-- -----------------------------------------------------
-- Daily Counts Indexes
-- Compliance and count tracking
-- -----------------------------------------------------

-- Primary pattern: Counts by date
-- Used by: Missing counts report, compliance dashboard
CREATE INDEX IF NOT EXISTS idx_daily_counts_date
ON daily_counts(count_date DESC);

-- Store-specific count history
-- Used by: Store compliance view
CREATE INDEX IF NOT EXISTS idx_daily_counts_store_date
ON daily_counts(store_id, count_date DESC);

-- -----------------------------------------------------
-- Profiles Indexes
-- User management and role-based access
-- -----------------------------------------------------

-- Staff-to-store assignment lookups
-- Used by: Every role-based access check for Staff
CREATE INDEX IF NOT EXISTS idx_profiles_store
ON profiles(store_id)
WHERE store_id IS NOT NULL;

-- Role-based filtering
-- Used by: User management, role-specific queries
CREATE INDEX IF NOT EXISTS idx_profiles_role_status
ON profiles(role, status);

-- Email lookups (for invite deduplication)
CREATE INDEX IF NOT EXISTS idx_profiles_email
ON profiles(lower(email));

-- -----------------------------------------------------
-- Reference Table Indexes
-- Stores and Inventory Items
-- -----------------------------------------------------

-- Active stores with name for listings
-- Used by: Store dropdowns, filtered lists
CREATE INDEX IF NOT EXISTS idx_stores_active_name
ON stores(is_active, name);

-- Active inventory items for listings
-- Used by: Inventory dropdowns, filtered lists
CREATE INDEX IF NOT EXISTS idx_inventory_items_active_name
ON inventory_items(is_active, name);

-- Category filtering
-- Used by: Inventory by category views
CREATE INDEX IF NOT EXISTS idx_inventory_items_category
ON inventory_items(category, is_active);


-- =====================================================
-- SECTION 2: OPTIMIZED DATABASE FUNCTIONS
-- =====================================================

-- -----------------------------------------------------
-- Function: Get missing counts for a date
-- Replaces: Two queries + JavaScript Set difference
-- Performance: Single query with LEFT JOIN anti-pattern
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION get_missing_counts(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
    store_id UUID,
    store_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_missing_counts TO authenticated;


-- -----------------------------------------------------
-- Function: Check shift overlap
-- Replaces: Complex string concatenation in OR clause
-- Performance: Uses indexed range comparison
-- -----------------------------------------------------
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

GRANT EXECUTE ON FUNCTION check_shift_overlap TO authenticated;


-- -----------------------------------------------------
-- Function: Get low stock items
-- Replaces: Full table scan + JavaScript filtering
-- Performance: Single optimized query with joins
-- -----------------------------------------------------
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

GRANT EXECUTE ON FUNCTION get_low_stock_items TO authenticated;


-- -----------------------------------------------------
-- Function: Get stock history with pagination
-- Replaces: Complex query building in application
-- Performance: Optimized single query with proper indexes
-- -----------------------------------------------------
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

GRANT EXECUTE ON FUNCTION get_stock_history TO authenticated;


-- -----------------------------------------------------
-- Function: Get daily summary stats
-- Replaces: Multiple queries with aggregation
-- Performance: Single query with window functions
-- -----------------------------------------------------
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
          AND (p_store_id IS NULL OR store_id = p_store_id)
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
          AND (p_store_id IS NULL OR id = p_store_id)
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

GRANT EXECUTE ON FUNCTION get_daily_summary TO authenticated;


-- =====================================================
-- SECTION 3: UPDATE STATISTICS
-- =====================================================

-- Analyze all tables to update query planner statistics
-- This helps PostgreSQL choose optimal query plans
ANALYZE stores;
ANALYZE profiles;
ANALYZE inventory_items;
ANALYZE store_inventory;
ANALYZE stock_history;
ANALYZE shifts;
ANALYZE daily_counts;


-- =====================================================
-- SECTION 4: COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION get_missing_counts IS 'Returns stores that have not submitted a daily count for the given date. Uses LEFT JOIN anti-pattern for efficiency.';
COMMENT ON FUNCTION check_shift_overlap IS 'Checks if a shift would overlap with existing shifts for a user. Returns true if overlap exists.';
COMMENT ON FUNCTION get_low_stock_items IS 'Returns all inventory items below PAR level, optionally filtered by store.';
COMMENT ON FUNCTION get_stock_history IS 'Returns paginated stock history with filters. Replaces complex client-side query building.';
COMMENT ON FUNCTION get_daily_summary IS 'Returns aggregated statistics for a given date including counts, receptions, and compliance.';
