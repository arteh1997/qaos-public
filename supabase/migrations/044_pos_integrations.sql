-- Migration 044: POS Integration Tables
-- Stores POS system connections and item mappings for automatic inventory deduction

-- POS connections table - stores credentials and configuration for each POS system
CREATE TABLE IF NOT EXISTS pos_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('square', 'toast', 'clover', 'lightspeed', 'custom')),
  name TEXT NOT NULL, -- Display name (e.g., "Main Square POS")
  is_active BOOLEAN NOT NULL DEFAULT true,
  credentials JSONB NOT NULL DEFAULT '{}', -- Encrypted API keys, tokens
  config JSONB NOT NULL DEFAULT '{}', -- Provider-specific configuration
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'synced', 'error')),
  sync_error TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pos_connections_store_id ON pos_connections(store_id);

-- POS item mappings - maps POS menu items to inventory items
CREATE TABLE IF NOT EXISTS pos_item_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_connection_id UUID NOT NULL REFERENCES pos_connections(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  pos_item_id TEXT NOT NULL, -- External ID from POS system
  pos_item_name TEXT NOT NULL, -- Name from POS system
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity_per_sale NUMERIC NOT NULL DEFAULT 1, -- How much inventory to deduct per sale
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pos_connection_id, pos_item_id)
);

CREATE INDEX idx_pos_item_mappings_connection ON pos_item_mappings(pos_connection_id);
CREATE INDEX idx_pos_item_mappings_store ON pos_item_mappings(store_id);
CREATE INDEX idx_pos_item_mappings_pos_item ON pos_item_mappings(pos_item_id);

-- POS sale events - tracks incoming sale events from POS
CREATE TABLE IF NOT EXISTS pos_sale_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_connection_id UUID NOT NULL REFERENCES pos_connections(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  external_event_id TEXT NOT NULL, -- ID from POS system for deduplication
  event_type TEXT NOT NULL DEFAULT 'sale' CHECK (event_type IN ('sale', 'refund', 'void')),
  items JSONB NOT NULL DEFAULT '[]', -- Array of sold items
  total_amount NUMERIC,
  currency TEXT DEFAULT 'USD',
  occurred_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'skipped')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pos_connection_id, external_event_id) -- Deduplication
);

CREATE INDEX idx_pos_sale_events_connection ON pos_sale_events(pos_connection_id);
CREATE INDEX idx_pos_sale_events_store ON pos_sale_events(store_id);
CREATE INDEX idx_pos_sale_events_status ON pos_sale_events(status);
CREATE INDEX idx_pos_sale_events_occurred ON pos_sale_events(occurred_at);

-- RLS policies
ALTER TABLE pos_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_item_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sale_events ENABLE ROW LEVEL SECURITY;

-- POS connections: Owners/Managers can manage their store's connections
CREATE POLICY "pos_connections_select" ON pos_connections
  FOR SELECT USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "pos_connections_insert" ON pos_connections
  FOR INSERT WITH CHECK (store_id = ANY(get_user_store_ids()));

CREATE POLICY "pos_connections_update" ON pos_connections
  FOR UPDATE USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "pos_connections_delete" ON pos_connections
  FOR DELETE USING (store_id = ANY(get_user_store_ids()));

-- POS item mappings: Same access as connections
CREATE POLICY "pos_item_mappings_select" ON pos_item_mappings
  FOR SELECT USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "pos_item_mappings_insert" ON pos_item_mappings
  FOR INSERT WITH CHECK (store_id = ANY(get_user_store_ids()));

CREATE POLICY "pos_item_mappings_update" ON pos_item_mappings
  FOR UPDATE USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "pos_item_mappings_delete" ON pos_item_mappings
  FOR DELETE USING (store_id = ANY(get_user_store_ids()));

-- POS sale events: Owners/Managers can view their store's events
CREATE POLICY "pos_sale_events_select" ON pos_sale_events
  FOR SELECT USING (store_id = ANY(get_user_store_ids()));

-- Updated_at triggers
CREATE OR REPLACE TRIGGER update_pos_connections_updated_at
  BEFORE UPDATE ON pos_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_pos_item_mappings_updated_at
  BEFORE UPDATE ON pos_item_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
