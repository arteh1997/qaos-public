-- Migration 065: Low stock server-side function + missing composite indexes

-- 1. Server-side low stock filtering function
-- Replaces broken client-side post-filter with accurate pagination
CREATE OR REPLACE FUNCTION get_low_stock_inventory(
  p_store_id UUID,
  p_category TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  store_id UUID,
  inventory_item_id UUID,
  quantity NUMERIC,
  par_level NUMERIC,
  last_updated_at TIMESTAMPTZ,
  last_updated_by UUID,
  item_id UUID,
  item_name TEXT,
  item_category TEXT,
  item_unit_of_measure TEXT,
  total_count BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    si.store_id,
    si.inventory_item_id,
    si.quantity,
    si.par_level,
    si.last_updated_at,
    si.last_updated_by,
    ii.id AS item_id,
    ii.name AS item_name,
    ii.category AS item_category,
    ii.unit_of_measure AS item_unit_of_measure,
    COUNT(*) OVER() AS total_count
  FROM store_inventory si
  JOIN inventory_items ii ON ii.id = si.inventory_item_id
  WHERE si.store_id = p_store_id
    AND si.par_level IS NOT NULL
    AND si.quantity < si.par_level
    AND (p_category IS NULL OR ii.category = p_category)
    AND ii.is_active = true
  ORDER BY (si.quantity / NULLIF(si.par_level, 0)) ASC
  LIMIT p_limit
  OFFSET p_offset
$$;

-- 2. Missing composite indexes for common query patterns

-- alert_preferences: queries always filter by (user_id, store_id) together
CREATE INDEX IF NOT EXISTS idx_alert_preferences_user_store
  ON alert_preferences (user_id, store_id);

-- alert_history: dashboard queries filter by store + time range
CREATE INDEX IF NOT EXISTS idx_alert_history_store_sent
  ON alert_history (store_id, sent_at DESC);

-- alert_history: queries filter by store + alert type
CREATE INDEX IF NOT EXISTS idx_alert_history_store_type
  ON alert_history (store_id, alert_type);

-- accounting_sync_log: sync status queries filter by store + time
CREATE INDEX IF NOT EXISTS idx_accounting_sync_log_store_created
  ON accounting_sync_log (store_id, created_at DESC);

-- supplier_portal_activity: activity feed queries filter by store + time
CREATE INDEX IF NOT EXISTS idx_supplier_portal_activity_store_created
  ON supplier_portal_activity (store_id, created_at DESC);
