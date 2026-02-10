-- Migration 043: API Keys and Webhook Endpoints
-- Adds public API key management and webhook delivery system

-- API Keys table - stores hashed API keys for programmatic access
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL, -- First 8 chars of the key for identification
  key_hash TEXT NOT NULL, -- SHA-256 hash of the full key
  scopes TEXT[] NOT NULL DEFAULT '{}', -- e.g., ['inventory:read', 'stock:write']
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_store_id ON api_keys(store_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);

-- Webhook endpoints table - stores webhook URLs for event delivery
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  url TEXT NOT NULL,
  secret TEXT NOT NULL, -- For signing webhook payloads (HMAC-SHA256)
  events TEXT[] NOT NULL DEFAULT '{}', -- e.g., ['inventory.updated', 'stock.counted']
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_endpoints_store_id ON webhook_endpoints(store_id);

-- Webhook deliveries table - tracks delivery attempts for each event
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  response_status INTEGER,
  response_body TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_deliveries_endpoint ON webhook_deliveries(webhook_endpoint_id);
CREATE INDEX idx_webhook_deliveries_store ON webhook_deliveries(store_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);

-- RLS policies
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- API keys: Owners/Managers can manage their store's keys
CREATE POLICY "api_keys_select" ON api_keys
  FOR SELECT USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "api_keys_insert" ON api_keys
  FOR INSERT WITH CHECK (store_id = ANY(get_user_store_ids()));

CREATE POLICY "api_keys_update" ON api_keys
  FOR UPDATE USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "api_keys_delete" ON api_keys
  FOR DELETE USING (store_id = ANY(get_user_store_ids()));

-- Webhook endpoints: Owners/Managers can manage their store's webhooks
CREATE POLICY "webhook_endpoints_select" ON webhook_endpoints
  FOR SELECT USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "webhook_endpoints_insert" ON webhook_endpoints
  FOR INSERT WITH CHECK (store_id = ANY(get_user_store_ids()));

CREATE POLICY "webhook_endpoints_update" ON webhook_endpoints
  FOR UPDATE USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "webhook_endpoints_delete" ON webhook_endpoints
  FOR DELETE USING (store_id = ANY(get_user_store_ids()));

-- Webhook deliveries: Owners/Managers can view their store's deliveries
CREATE POLICY "webhook_deliveries_select" ON webhook_deliveries
  FOR SELECT USING (store_id = ANY(get_user_store_ids()));

-- Updated_at triggers
CREATE OR REPLACE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_webhook_endpoints_updated_at
  BEFORE UPDATE ON webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
