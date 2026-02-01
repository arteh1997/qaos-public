-- Migration: Multi-Tenant Schema
-- Description: Add store_users junction table for multi-tenant store access,
--              subscriptions table for future billing, and supporting columns.

-- ============================================================================
-- 1. Create store_users junction table
-- ============================================================================
-- This table replaces the profiles.store_id column with a many-to-many relationship
-- allowing users to have different roles at different stores.

CREATE TABLE IF NOT EXISTS store_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('Owner', 'Manager', 'Staff', 'Driver')),
  is_billing_owner BOOLEAN NOT NULL DEFAULT false,
  invited_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, user_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_store_users_user_id ON store_users(user_id);
CREATE INDEX IF NOT EXISTS idx_store_users_store_id ON store_users(store_id);
CREATE INDEX IF NOT EXISTS idx_store_users_role ON store_users(role);
CREATE INDEX IF NOT EXISTS idx_store_users_billing_owner ON store_users(store_id) WHERE is_billing_owner = true;

-- Enable RLS on store_users
ALTER TABLE store_users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. Create subscriptions table (for future billing integration)
-- ============================================================================
-- Schema is created now but Stripe integration is deferred.
-- All stores will default to 'active' status for development.

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  billing_user_id UUID NOT NULL REFERENCES profiles(id),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id)
);

-- Indexes for subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_billing_user ON subscriptions(billing_user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Enable RLS on subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. Add columns to stores table
-- ============================================================================

-- billing_user_id: The user responsible for paying for this store
ALTER TABLE stores ADD COLUMN IF NOT EXISTS billing_user_id UUID REFERENCES profiles(id);

-- subscription_status: Quick lookup for store's billing status
ALTER TABLE stores ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';

-- Index for billing queries
CREATE INDEX IF NOT EXISTS idx_stores_billing_user ON stores(billing_user_id) WHERE billing_user_id IS NOT NULL;

-- ============================================================================
-- 4. Add columns to profiles table
-- ============================================================================

-- is_platform_admin: Super-admin access (for platform support/maintenance)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT false;

-- default_store_id: User's preferred store for quick access
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_store_id UUID REFERENCES stores(id);

-- Index for platform admins
CREATE INDEX IF NOT EXISTS idx_profiles_platform_admin ON profiles(id) WHERE is_platform_admin = true;

-- ============================================================================
-- 5. Data Migration: Move existing users to store_users table
-- ============================================================================

-- Migrate Admin users to Owners of all stores
-- Each Admin becomes an Owner (with billing responsibility) of every store
INSERT INTO store_users (store_id, user_id, role, is_billing_owner, created_at, updated_at)
SELECT
  s.id,
  p.id,
  'Owner',
  true,
  now(),
  now()
FROM profiles p
CROSS JOIN stores s
WHERE p.role = 'Admin'
ON CONFLICT (store_id, user_id) DO NOTHING;

-- Migrate Staff users to their assigned store
INSERT INTO store_users (store_id, user_id, role, is_billing_owner, created_at, updated_at)
SELECT
  p.store_id,
  p.id,
  'Staff',
  false,
  now(),
  now()
FROM profiles p
WHERE p.role = 'Staff'
  AND p.store_id IS NOT NULL
ON CONFLICT (store_id, user_id) DO NOTHING;

-- Migrate Driver users to all active stores
INSERT INTO store_users (store_id, user_id, role, is_billing_owner, created_at, updated_at)
SELECT
  s.id,
  p.id,
  'Driver',
  false,
  now(),
  now()
FROM profiles p
CROSS JOIN stores s
WHERE p.role = 'Driver'
  AND s.is_active = true
ON CONFLICT (store_id, user_id) DO NOTHING;

-- Set billing_user_id on stores to the first Admin user (temporary)
-- In production, each store would have its own billing owner
UPDATE stores
SET billing_user_id = (
  SELECT p.id
  FROM profiles p
  WHERE p.role = 'Admin'
  ORDER BY p.created_at
  LIMIT 1
)
WHERE billing_user_id IS NULL;

-- Set default_store_id for Staff users to their assigned store
UPDATE profiles
SET default_store_id = store_id
WHERE role = 'Staff'
  AND store_id IS NOT NULL
  AND default_store_id IS NULL;

-- ============================================================================
-- 6. Updated_at trigger for store_users
-- ============================================================================

CREATE OR REPLACE FUNCTION update_store_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS store_users_updated_at ON store_users;
CREATE TRIGGER store_users_updated_at
  BEFORE UPDATE ON store_users
  FOR EACH ROW
  EXECUTE FUNCTION update_store_users_updated_at();

-- ============================================================================
-- 7. Updated_at trigger for subscriptions
-- ============================================================================

CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();

-- ============================================================================
-- NOTE: profiles.role and profiles.store_id are kept for backward compatibility
-- They will be deprecated in a future migration once the transition is complete.
-- ============================================================================
