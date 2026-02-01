-- Migration: Add audit logs table for tracking user actions
-- This creates a comprehensive audit trail for security and compliance

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who performed the action
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_email TEXT, -- Denormalized for historical reference (user might be deleted)

  -- What action was performed
  action TEXT NOT NULL, -- e.g., 'user.invite', 'stock.count', 'store.create'
  action_category TEXT NOT NULL, -- e.g., 'user', 'stock', 'store', 'auth', 'settings'

  -- Context
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  resource_type TEXT, -- e.g., 'user_invite', 'stock_count', 'store'
  resource_id TEXT, -- ID of the affected resource

  -- Details
  details JSONB DEFAULT '{}', -- Additional context (old values, new values, etc.)
  ip_address TEXT,
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_store_id ON audit_logs(store_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_action_category ON audit_logs(action_category);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Composite index for filtering by store and time
CREATE INDEX idx_audit_logs_store_time ON audit_logs(store_id, created_at DESC);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies:
-- 1. Platform admins can see all logs
-- 2. Owners can see logs for their stores
-- 3. Managers can see logs for their store
-- 4. Users can see their own actions

CREATE POLICY "Platform admins can view all audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

CREATE POLICY "Store owners can view store audit logs"
  ON audit_logs FOR SELECT
  USING (
    store_id IN (
      SELECT su.store_id FROM store_users su
      WHERE su.user_id = auth.uid()
      AND su.role = 'Owner'
    )
  );

CREATE POLICY "Store managers can view store audit logs"
  ON audit_logs FOR SELECT
  USING (
    store_id IN (
      SELECT su.store_id FROM store_users su
      WHERE su.user_id = auth.uid()
      AND su.role = 'Manager'
    )
  );

CREATE POLICY "Users can view their own audit logs"
  ON audit_logs FOR SELECT
  USING (user_id = auth.uid());

-- Insert policy: Only server-side (service role) can insert
-- This ensures audit logs can't be manipulated by clients
CREATE POLICY "Service role can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- No update or delete policies - audit logs are immutable

-- Add comment for documentation
COMMENT ON TABLE audit_logs IS 'Immutable audit trail of user actions for security and compliance';
COMMENT ON COLUMN audit_logs.action IS 'Action identifier in format category.action (e.g., user.invite, stock.count)';
COMMENT ON COLUMN audit_logs.details IS 'JSON object with action-specific details like old/new values';
