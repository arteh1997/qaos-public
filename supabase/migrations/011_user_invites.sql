-- Migration: User Invites Table
-- Creates a table to store pending user invitations with secure tokens

-- Create user_invites table
CREATE TABLE IF NOT EXISTS user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Owner', 'Manager', 'Staff', 'Driver')),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  store_ids UUID[] DEFAULT '{}', -- For Driver role - multiple stores
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_user_invites_token ON user_invites(token);
CREATE INDEX idx_user_invites_email ON user_invites(email);
CREATE INDEX idx_user_invites_expires_at ON user_invites(expires_at);
CREATE INDEX idx_user_invites_invited_by ON user_invites(invited_by);

-- Enable RLS
ALTER TABLE user_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_invites

-- Owners and Managers can view invites they created or for their stores
CREATE POLICY "Users can view invites they created"
  ON user_invites FOR SELECT
  USING (
    invited_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM store_users su
      WHERE su.user_id = auth.uid()
      AND su.role IN ('Owner', 'Manager')
      AND (
        user_invites.store_id = su.store_id
        OR user_invites.store_id = ANY(
          SELECT store_id FROM store_users WHERE user_id = auth.uid() AND role IN ('Owner', 'Manager')
        )
      )
    )
  );

-- Owners can create invites for Co-Owner, Manager, Staff, Driver
-- Managers can only create invites for Staff and Driver
CREATE POLICY "Authorized users can create invites"
  ON user_invites FOR INSERT
  WITH CHECK (
    invited_by = auth.uid()
    AND (
      -- Platform admin can invite anyone
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
      OR
      -- Owner can invite Co-Owner (Owner role), Manager, Staff, Driver
      (
        EXISTS (
          SELECT 1 FROM store_users su
          WHERE su.user_id = auth.uid()
          AND su.role = 'Owner'
          AND (
            su.store_id = user_invites.store_id
            OR user_invites.role = 'Driver'
          )
        )
        AND user_invites.role IN ('Owner', 'Manager', 'Staff', 'Driver')
      )
      OR
      -- Manager can only invite Staff and Driver for their store
      (
        EXISTS (
          SELECT 1 FROM store_users su
          WHERE su.user_id = auth.uid()
          AND su.role = 'Manager'
          AND (
            su.store_id = user_invites.store_id
            OR user_invites.role = 'Driver'
          )
        )
        AND user_invites.role IN ('Staff', 'Driver')
      )
    )
  );

-- Users can delete (cancel) invites they created
CREATE POLICY "Users can delete invites they created"
  ON user_invites FOR DELETE
  USING (invited_by = auth.uid());

-- Update policy for marking invite as used (will be done by service role)
CREATE POLICY "Service role can update invites"
  ON user_invites FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Function to clean up expired invites (can be called by a cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_invites()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_invites
  WHERE expires_at < now() AND used_at IS NULL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Grant execute permission to authenticated users (for manual cleanup if needed)
GRANT EXECUTE ON FUNCTION cleanup_expired_invites() TO authenticated;

COMMENT ON TABLE user_invites IS 'Stores pending user invitations with secure tokens';
COMMENT ON COLUMN user_invites.token IS 'Secure random token for the invite link';
COMMENT ON COLUMN user_invites.expires_at IS 'Invite expires 1 hour after creation';
COMMENT ON COLUMN user_invites.used_at IS 'Timestamp when the invite was used (user completed onboarding)';
COMMENT ON COLUMN user_invites.store_ids IS 'Array of store IDs for Driver role (can work at multiple stores)';
