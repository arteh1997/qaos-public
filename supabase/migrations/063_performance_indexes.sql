-- Migration 063: Performance indexes for HACCP and tag queries
-- Adds composite indexes identified in architecture audit

-- HACCP checks: dashboard queries filter by store + order by completed_at
CREATE INDEX IF NOT EXISTS idx_haccp_checks_store_date
  ON haccp_checks(store_id, completed_at DESC);

-- HACCP temperature logs: time-series queries by store
CREATE INDEX IF NOT EXISTS idx_haccp_temp_logs_store_date
  ON haccp_temperature_logs(store_id, recorded_at DESC);

-- HACCP corrective actions: unresolved action queries
CREATE INDEX IF NOT EXISTS idx_haccp_corrective_store_resolved
  ON haccp_corrective_actions(store_id, resolved_at);

-- Inventory item tags: tag lookup by item (junction table)
CREATE INDEX IF NOT EXISTS idx_inventory_item_tags_item_id
  ON inventory_item_tags(inventory_item_id);

-- Stock history: common query pattern is store + date range
CREATE INDEX IF NOT EXISTS idx_stock_history_store_created
  ON stock_history(store_id, created_at DESC);

-- Audit logs: common query pattern is store + date range
CREATE INDEX IF NOT EXISTS idx_audit_logs_store_created
  ON audit_logs(store_id, created_at DESC);
