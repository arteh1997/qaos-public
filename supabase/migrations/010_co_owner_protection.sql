-- Migration: Co-Owner Protection
-- Description: Add RLS policies to protect billing owners from removal
--              and ensure proper co-owner permissions

-- ============================================================================
-- 1. Drop existing store_users policies to recreate with better logic
-- ============================================================================

DROP POLICY IF EXISTS "store_users_select" ON store_users;
DROP POLICY IF EXISTS "store_users_insert" ON store_users;
DROP POLICY IF EXISTS "store_users_update" ON store_users;
DROP POLICY IF EXISTS "store_users_delete" ON store_users;

-- ============================================================================
-- 2. Helper function: Check if user is an Owner at a specific store
-- ============================================================================

CREATE OR REPLACE FUNCTION is_store_owner(p_store_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM store_users
    WHERE store_id = p_store_id
      AND user_id = auth.uid()
      AND role = 'Owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- 3. Helper function: Check if user is the billing owner of a store
-- ============================================================================

CREATE OR REPLACE FUNCTION is_billing_owner(p_store_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM store_users
    WHERE store_id = p_store_id
      AND user_id = auth.uid()
      AND is_billing_owner = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- 4. Helper function: Check if a store_users record is for the billing owner
-- ============================================================================

CREATE OR REPLACE FUNCTION is_billing_owner_record(p_store_users_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM store_users
    WHERE id = p_store_users_id
      AND is_billing_owner = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- 5. Create new RLS policies for store_users
-- ============================================================================

-- SELECT: Users can see their own memberships + Owners can see all users at their stores
CREATE POLICY "store_users_select" ON store_users FOR SELECT USING (
  user_id = auth.uid()  -- See your own memberships
  OR is_store_owner(store_id)  -- Owners can see all users at their stores
  OR is_platform_admin()  -- Platform admins see all
);

-- INSERT: Only Owners can add users to their stores
CREATE POLICY "store_users_insert" ON store_users FOR INSERT WITH CHECK (
  is_store_owner(store_id)
  OR is_platform_admin()
);

-- UPDATE: Owners can update roles, but cannot change billing owner flag unless they ARE billing owner
CREATE POLICY "store_users_update" ON store_users FOR UPDATE USING (
  -- Must be an owner at this store
  (is_store_owner(store_id) OR is_platform_admin())
  -- Cannot modify billing owner flag unless you are the billing owner
  AND (
    -- If not changing is_billing_owner, allow
    (OLD.is_billing_owner = NEW.is_billing_owner)
    -- Or if you are the billing owner, you can change it
    OR is_billing_owner(store_id)
    OR is_platform_admin()
  )
);

-- DELETE: Owners can remove users, but NOT the billing owner
CREATE POLICY "store_users_delete" ON store_users FOR DELETE USING (
  -- Must be an owner at this store (or platform admin)
  (is_store_owner(store_id) OR is_platform_admin())
  -- Cannot delete the billing owner record
  AND NOT is_billing_owner_record(id)
);

-- ============================================================================
-- 6. Add index for better performance on billing owner lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_store_users_billing_owner_lookup
  ON store_users(store_id, user_id, is_billing_owner);

-- ============================================================================
-- 7. Comment on the is_billing_owner column for documentation
-- ============================================================================

COMMENT ON COLUMN store_users.is_billing_owner IS
  'True if this user is the billing owner of the store. Billing owners cannot be removed by other users and are responsible for the store subscription.';
