-- Migration 064: Archive tables for high-growth data
-- Creates archive tables for stock_history and audit_logs to keep main tables lean
-- Records older than 12 months are moved by the weekly cron job

-- Archive table for stock_history
CREATE TABLE IF NOT EXISTS stock_history_archive (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL,
  inventory_item_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  quantity_before NUMERIC NOT NULL DEFAULT 0,
  quantity_after NUMERIC NOT NULL DEFAULT 0,
  quantity_change NUMERIC NOT NULL DEFAULT 0,
  performed_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Archive table for audit_logs
CREATE TABLE IF NOT EXISTS audit_logs_archive (
  id UUID PRIMARY KEY,
  user_id UUID,
  store_id UUID,
  action TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite indexes for common archive queries (store + date range)
CREATE INDEX IF NOT EXISTS idx_stock_history_archive_store_date
  ON stock_history_archive (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_store_date
  ON audit_logs_archive (store_id, created_at DESC);

-- Enable RLS on archive tables
ALTER TABLE stock_history_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs_archive ENABLE ROW LEVEL SECURITY;

-- RLS policies: only service role (admin) can access archive tables
CREATE POLICY "Service role access only" ON stock_history_archive
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role access only" ON audit_logs_archive
  FOR ALL USING (auth.role() = 'service_role');
