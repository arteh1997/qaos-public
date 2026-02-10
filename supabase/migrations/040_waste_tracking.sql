-- Migration: 040_waste_tracking.sql
-- Description: Add waste tracking infrastructure
-- - Create waste_log table for detailed per-item waste tracking
-- - RLS policies for waste_log
-- Note: stock_history.action_type is TEXT, not an enum. 'Waste' and 'Sale'
-- values are already supported without schema changes.

-- 1. Create waste_log table for detailed waste tracking
CREATE TABLE IF NOT EXISTS waste_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL CHECK (reason IN ('spoilage', 'damaged', 'expired', 'overproduction', 'other')),
  notes TEXT,
  estimated_cost NUMERIC DEFAULT 0,
  reported_by UUID NOT NULL REFERENCES profiles(id),
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_waste_log_store_id ON waste_log(store_id);
CREATE INDEX IF NOT EXISTS idx_waste_log_reported_at ON waste_log(reported_at);
CREATE INDEX IF NOT EXISTS idx_waste_log_reason ON waste_log(reason);
CREATE INDEX IF NOT EXISTS idx_waste_log_inventory_item ON waste_log(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_waste_log_store_date ON waste_log(store_id, reported_at DESC);

-- 3. Enable RLS
ALTER TABLE waste_log ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Users can view waste logs for stores they belong to
CREATE POLICY "waste_log_select" ON waste_log
  FOR SELECT USING (store_id = ANY(get_user_store_ids()));

-- Owner, Manager, Staff can insert waste reports for their stores
CREATE POLICY "waste_log_insert" ON waste_log
  FOR INSERT WITH CHECK (store_id = ANY(get_user_store_ids()));

-- No UPDATE or DELETE policies - waste logs are immutable audit records
