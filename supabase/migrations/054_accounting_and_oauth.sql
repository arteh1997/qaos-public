-- Migration 054: Accounting Connections & OAuth States
-- Supports Xero (Priority 2) and QuickBooks (Priority 4) integrations.
-- Also creates a shared integration_oauth_states table for POS OAuth (Priority 3).

-- ============================================================
-- Accounting connections (Xero, QuickBooks)
-- ============================================================
CREATE TABLE accounting_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('xero', 'quickbooks')),

  -- OAuth credentials (encrypted at rest by Supabase)
  credentials JSONB NOT NULL DEFAULT '{}',
  -- { access_token, refresh_token, expires_at, token_type, scope, tenant_id (Xero) / realm_id (QBO) }

  -- Configuration
  config JSONB NOT NULL DEFAULT '{}',
  -- { gl_mappings: { category -> account_code }, auto_sync: boolean, sync_invoices: boolean, sync_purchase_orders: boolean }

  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT NOT NULL DEFAULT 'idle'
    CHECK (sync_status IN ('idle', 'syncing', 'error')),
  sync_error TEXT,

  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(store_id, provider)
);

-- ============================================================
-- Accounting sync log (tracks each push/pull operation)
-- ============================================================
CREATE TABLE accounting_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES accounting_connections(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  entity_type TEXT NOT NULL CHECK (entity_type IN ('invoice', 'bill', 'payment', 'contact', 'purchase_order')),
  entity_id UUID NOT NULL,
  external_id TEXT,

  direction TEXT NOT NULL CHECK (direction IN ('push', 'pull')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  payload JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(connection_id, entity_type, entity_id, direction)
);

-- ============================================================
-- Integration OAuth states (shared across Xero, QBO, POS OAuth flows)
-- ============================================================
CREATE TABLE integration_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  state_token TEXT NOT NULL UNIQUE,
  redirect_data JSONB DEFAULT '{}',

  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_accounting_connections_store ON accounting_connections(store_id);
CREATE INDEX idx_accounting_connections_provider ON accounting_connections(provider);
CREATE INDEX idx_accounting_sync_log_connection ON accounting_sync_log(connection_id);
CREATE INDEX idx_accounting_sync_log_store ON accounting_sync_log(store_id);
CREATE INDEX idx_accounting_sync_log_entity ON accounting_sync_log(entity_type, entity_id);
CREATE INDEX idx_integration_oauth_states_token ON integration_oauth_states(state_token);
CREATE INDEX idx_integration_oauth_states_expires ON integration_oauth_states(expires_at);

-- ============================================================
-- Row-Level Security
-- ============================================================
ALTER TABLE accounting_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_oauth_states ENABLE ROW LEVEL SECURITY;

-- accounting_connections
CREATE POLICY "accounting_connections_select" ON accounting_connections
  FOR SELECT USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "accounting_connections_insert" ON accounting_connections
  FOR INSERT WITH CHECK (store_id = ANY(get_user_store_ids()));

CREATE POLICY "accounting_connections_update" ON accounting_connections
  FOR UPDATE USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "accounting_connections_delete" ON accounting_connections
  FOR DELETE USING (store_id = ANY(get_user_store_ids()));

-- accounting_sync_log
CREATE POLICY "accounting_sync_log_select" ON accounting_sync_log
  FOR SELECT USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "accounting_sync_log_insert" ON accounting_sync_log
  FOR INSERT WITH CHECK (store_id = ANY(get_user_store_ids()));

-- integration_oauth_states
CREATE POLICY "integration_oauth_states_select" ON integration_oauth_states
  FOR SELECT USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "integration_oauth_states_insert" ON integration_oauth_states
  FOR INSERT WITH CHECK (store_id = ANY(get_user_store_ids()));

CREATE POLICY "integration_oauth_states_delete" ON integration_oauth_states
  FOR DELETE USING (store_id = ANY(get_user_store_ids()));

-- ============================================================
-- Triggers
-- ============================================================
CREATE TRIGGER set_accounting_connections_updated_at
  BEFORE UPDATE ON accounting_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
