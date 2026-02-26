-- Migration 050: Payroll & Staff Payments
--
-- Adds hourly rates to store_users and creates pay_runs/pay_run_items
-- for tracking staff payments. This is record-keeping, not payment processing.

-- ============================================================
-- 1. ADD HOURLY RATE TO STORE_USERS
-- ============================================================
-- Per-store, per-employee rate. Same person can have different rates at different stores.
ALTER TABLE store_users ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC DEFAULT NULL;

-- ============================================================
-- 2. PAY_RUNS TABLE (batch payroll records)
-- ============================================================
CREATE TABLE IF NOT EXISTS pay_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'paid')),
  notes TEXT,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'GBP',
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  paid_by UUID REFERENCES profiles(id),
  paid_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pay_runs_store_id ON pay_runs(store_id);
CREATE INDEX idx_pay_runs_status ON pay_runs(store_id, status);
CREATE INDEX idx_pay_runs_period ON pay_runs(store_id, period_start DESC, period_end DESC);

-- ============================================================
-- 3. PAY_RUN_ITEMS TABLE (one row per employee per pay run)
-- ============================================================
CREATE TABLE IF NOT EXISTS pay_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_run_id UUID NOT NULL REFERENCES pay_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  hourly_rate NUMERIC NOT NULL,
  total_hours NUMERIC NOT NULL DEFAULT 0,
  overtime_hours NUMERIC NOT NULL DEFAULT 0,
  adjustments NUMERIC NOT NULL DEFAULT 0,
  adjustment_notes TEXT,
  gross_pay NUMERIC NOT NULL DEFAULT 0,
  shift_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pay_run_id, user_id)
);

CREATE INDEX idx_pay_run_items_pay_run_id ON pay_run_items(pay_run_id);
CREATE INDEX idx_pay_run_items_user_id ON pay_run_items(user_id);

-- ============================================================
-- 4. UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE TRIGGER update_pay_runs_updated_at
  BEFORE UPDATE ON pay_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_pay_run_items_updated_at
  BEFORE UPDATE ON pay_run_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. RLS POLICIES
-- ============================================================
ALTER TABLE pay_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pay_run_items ENABLE ROW LEVEL SECURITY;

-- Pay runs: store-scoped
CREATE POLICY "pay_runs_select" ON pay_runs
  FOR SELECT USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "pay_runs_insert" ON pay_runs
  FOR INSERT WITH CHECK (store_id = ANY(get_user_store_ids()));

CREATE POLICY "pay_runs_update" ON pay_runs
  FOR UPDATE USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "pay_runs_delete" ON pay_runs
  FOR DELETE USING (store_id = ANY(get_user_store_ids()));

-- Pay run items: access via pay_run -> store chain
CREATE POLICY "pay_run_items_select" ON pay_run_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pay_runs pr
      WHERE pr.id = pay_run_items.pay_run_id
      AND pr.store_id = ANY(get_user_store_ids())
    )
  );

CREATE POLICY "pay_run_items_insert" ON pay_run_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM pay_runs pr
      WHERE pr.id = pay_run_items.pay_run_id
      AND pr.store_id = ANY(get_user_store_ids())
    )
  );

CREATE POLICY "pay_run_items_update" ON pay_run_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM pay_runs pr
      WHERE pr.id = pay_run_items.pay_run_id
      AND pr.store_id = ANY(get_user_store_ids())
    )
  );

CREATE POLICY "pay_run_items_delete" ON pay_run_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM pay_runs pr
      WHERE pr.id = pay_run_items.pay_run_id
      AND pr.store_id = ANY(get_user_store_ids())
    )
  );

-- ============================================================
-- 6. RELOAD POSTGREST SCHEMA CACHE
-- ============================================================
-- PostgREST caches the database schema. After DDL changes (new columns/tables),
-- it needs to be notified to pick them up.
NOTIFY pgrst, 'reload schema';
