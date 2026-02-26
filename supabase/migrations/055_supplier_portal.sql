-- Migration 055: Supplier Portal
-- Adds token-based auth for suppliers to access a self-service portal.
-- Suppliers can view POs, upload invoices, update pricing, track deliveries.

-- ── Supplier Portal Tokens ──
-- Token format: sp_live_<32 hex chars> (similar to API keys in api_keys table)
-- Only the SHA-256 hash is stored; token_prefix is for display (sp_live_xxxx…)
CREATE TABLE IF NOT EXISTS supplier_portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Auth
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,          -- e.g. "sp_live_a1b2c3d4"

  -- Permissions
  can_view_orders BOOLEAN NOT NULL DEFAULT true,
  can_upload_invoices BOOLEAN NOT NULL DEFAULT true,
  can_update_catalog BOOLEAN NOT NULL DEFAULT true,
  can_update_order_status BOOLEAN NOT NULL DEFAULT false,

  -- Meta
  name TEXT NOT NULL DEFAULT 'Default',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_spt_supplier ON supplier_portal_tokens(supplier_id);
CREATE INDEX idx_spt_store ON supplier_portal_tokens(store_id);
CREATE INDEX idx_spt_hash ON supplier_portal_tokens(token_hash);

-- Updated-at trigger
CREATE TRIGGER set_supplier_portal_tokens_updated_at
  BEFORE UPDATE ON supplier_portal_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE supplier_portal_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members can manage portal tokens"
  ON supplier_portal_tokens
  FOR ALL
  USING (store_id = ANY(get_user_store_ids()))
  WITH CHECK (store_id = ANY(get_user_store_ids()));


-- ── Supplier Portal Activity Log ──
CREATE TABLE IF NOT EXISTS supplier_portal_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  token_id UUID REFERENCES supplier_portal_tokens(id) ON DELETE SET NULL,

  action TEXT NOT NULL,                -- e.g. 'portal.login', 'order.viewed', 'catalog.updated'
  details JSONB NOT NULL DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_spa_supplier ON supplier_portal_activity(supplier_id);
CREATE INDEX idx_spa_store ON supplier_portal_activity(store_id);
CREATE INDEX idx_spa_created ON supplier_portal_activity(created_at DESC);

-- RLS
ALTER TABLE supplier_portal_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members can view portal activity"
  ON supplier_portal_activity
  FOR SELECT
  USING (store_id = ANY(get_user_store_ids()));

-- Allow inserts from service role (admin client) only — no user-facing insert policy needed.
