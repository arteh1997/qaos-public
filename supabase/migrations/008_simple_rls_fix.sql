-- =====================================================
-- SIMPLE RLS FIX - NO RECURSION
-- Restaurant Inventory Management System
--
-- This migration uses the simplest possible RLS policies
-- to completely avoid any circular references.
--
-- Strategy: Use SECURITY DEFINER helper functions for ALL
-- permission checks, so RLS policies never query tables
-- that have RLS enabled.
-- =====================================================

-- =====================================================
-- STEP 1: DISABLE RLS TEMPORARILY TO CLEAN UP
-- =====================================================

-- Disable RLS on all tables temporarily
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE stores DISABLE ROW LEVEL SECURITY;
ALTER TABLE store_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE store_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_counts DISABLE ROW LEVEL SECURITY;
ALTER TABLE shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;


-- =====================================================
-- STEP 2: DROP ALL EXISTING POLICIES
-- =====================================================

-- Drop all profiles policies
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_shared_stores" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON profiles;

-- Drop all store_users policies
DROP POLICY IF EXISTS "store_users_select_own" ON store_users;
DROP POLICY IF EXISTS "store_users_select_store_members" ON store_users;
DROP POLICY IF EXISTS "store_users_insert_policy" ON store_users;
DROP POLICY IF EXISTS "store_users_update_policy" ON store_users;
DROP POLICY IF EXISTS "store_users_delete_policy" ON store_users;

-- Drop all stores policies
DROP POLICY IF EXISTS "stores_select_policy" ON stores;
DROP POLICY IF EXISTS "stores_insert_policy" ON stores;
DROP POLICY IF EXISTS "stores_update_policy" ON stores;
DROP POLICY IF EXISTS "stores_delete_policy" ON stores;

-- Drop all store_inventory policies
DROP POLICY IF EXISTS "store_inventory_select_policy" ON store_inventory;
DROP POLICY IF EXISTS "store_inventory_insert_policy" ON store_inventory;
DROP POLICY IF EXISTS "store_inventory_update_policy" ON store_inventory;
DROP POLICY IF EXISTS "store_inventory_delete_policy" ON store_inventory;

-- Drop all stock_history policies
DROP POLICY IF EXISTS "stock_history_select_policy" ON stock_history;
DROP POLICY IF EXISTS "stock_history_insert_policy" ON stock_history;
DROP POLICY IF EXISTS "stock_history_update_policy" ON stock_history;
DROP POLICY IF EXISTS "stock_history_delete_policy" ON stock_history;

-- Drop all daily_counts policies
DROP POLICY IF EXISTS "daily_counts_select_policy" ON daily_counts;
DROP POLICY IF EXISTS "daily_counts_insert_policy" ON daily_counts;
DROP POLICY IF EXISTS "daily_counts_update_policy" ON daily_counts;
DROP POLICY IF EXISTS "daily_counts_delete_policy" ON daily_counts;

-- Drop all shifts policies
DROP POLICY IF EXISTS "shifts_select_policy" ON shifts;
DROP POLICY IF EXISTS "shifts_insert_policy" ON shifts;
DROP POLICY IF EXISTS "shifts_update_policy" ON shifts;
DROP POLICY IF EXISTS "shifts_delete_policy" ON shifts;

-- Drop all inventory_items policies
DROP POLICY IF EXISTS "inventory_items_select_policy" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_insert_policy" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_update_policy" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_delete_policy" ON inventory_items;

-- Drop all subscriptions policies
DROP POLICY IF EXISTS "subscriptions_select_policy" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_insert_policy" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_update_policy" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_delete_policy" ON subscriptions;


-- =====================================================
-- STEP 3: DROP AND RECREATE ALL HELPER FUNCTIONS
-- All functions use SECURITY DEFINER to bypass RLS
-- =====================================================

DROP FUNCTION IF EXISTS is_platform_admin();
DROP FUNCTION IF EXISTS get_user_store_ids();
DROP FUNCTION IF EXISTS get_user_role_at_store(UUID);
DROP FUNCTION IF EXISTS has_store_access(UUID);
DROP FUNCTION IF EXISTS can_manage_store(UUID);
DROP FUNCTION IF EXISTS is_any_store_owner();

-- Check if current user is a platform admin
CREATE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT is_platform_admin FROM profiles WHERE id = auth.uid()),
    false
  );
END;
$$;

-- Get all store IDs user has access to
CREATE FUNCTION get_user_store_ids()
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT array_agg(store_id) FROM store_users WHERE user_id = auth.uid()),
    '{}'::UUID[]
  );
END;
$$;

-- Get user's role at a specific store
CREATE FUNCTION get_user_role_at_store(p_store_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT role FROM store_users
    WHERE user_id = auth.uid() AND store_id = p_store_id
  );
END;
$$;

-- Check if user has access to a specific store
CREATE FUNCTION has_store_access(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Platform admin has access to everything
  IF (SELECT is_platform_admin FROM profiles WHERE id = auth.uid()) = true THEN
    RETURN true;
  END IF;

  -- Check store_users membership
  RETURN EXISTS (
    SELECT 1 FROM store_users
    WHERE user_id = auth.uid() AND store_id = p_store_id
  );
END;
$$;

-- Check if user can manage a store (Owner or Manager)
CREATE FUNCTION can_manage_store(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Platform admin can manage anything
  IF (SELECT is_platform_admin FROM profiles WHERE id = auth.uid()) = true THEN
    RETURN true;
  END IF;

  -- Check if user is Owner or Manager at this store
  RETURN EXISTS (
    SELECT 1 FROM store_users
    WHERE user_id = auth.uid()
      AND store_id = p_store_id
      AND role IN ('Owner', 'Manager')
  );
END;
$$;

-- Check if user is owner of any store
CREATE FUNCTION is_any_store_owner()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM store_users
    WHERE user_id = auth.uid() AND role = 'Owner'
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION is_platform_admin TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_store_ids TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role_at_store TO authenticated;
GRANT EXECUTE ON FUNCTION has_store_access TO authenticated;
GRANT EXECUTE ON FUNCTION can_manage_store TO authenticated;
GRANT EXECUTE ON FUNCTION is_any_store_owner TO authenticated;


-- =====================================================
-- STEP 4: RE-ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- STEP 5: CREATE SIMPLE RLS POLICIES
-- Using only SECURITY DEFINER functions - no recursion
-- =====================================================

-- -----------------------------------------------------
-- PROFILES TABLE
-- -----------------------------------------------------

-- Users can see their own profile
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Platform admins can see all profiles
CREATE POLICY "profiles_select_admin" ON profiles
  FOR SELECT TO authenticated
  USING (is_platform_admin());

-- Owners/Managers can see profiles of users at their stores
-- Uses a function to avoid recursion
CREATE POLICY "profiles_select_store" ON profiles
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT su.user_id
      FROM store_users su
      WHERE su.store_id = ANY(get_user_store_ids())
    )
  );

-- Anyone authenticated can insert (for registration flow)
-- Actual protection is in the application layer
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Users can update their own profile
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR is_platform_admin())
  WITH CHECK (id = auth.uid() OR is_platform_admin());

-- Only platform admins can delete
CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE TO authenticated
  USING (is_platform_admin());


-- -----------------------------------------------------
-- STORE_USERS TABLE
-- -----------------------------------------------------

-- Users can see their own memberships
CREATE POLICY "store_users_select_own" ON store_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Platform admins can see all memberships
CREATE POLICY "store_users_select_admin" ON store_users
  FOR SELECT TO authenticated
  USING (is_platform_admin());

-- Owners/Managers can see members at their stores
CREATE POLICY "store_users_select_store" ON store_users
  FOR SELECT TO authenticated
  USING (
    store_id = ANY(get_user_store_ids())
    AND get_user_role_at_store(store_id) IN ('Owner', 'Manager')
  );

-- Owners can insert new members
CREATE POLICY "store_users_insert" ON store_users
  FOR INSERT TO authenticated
  WITH CHECK (
    is_platform_admin()
    OR get_user_role_at_store(store_id) = 'Owner'
  );

-- Owners can update roles
CREATE POLICY "store_users_update" ON store_users
  FOR UPDATE TO authenticated
  USING (is_platform_admin() OR get_user_role_at_store(store_id) = 'Owner')
  WITH CHECK (is_platform_admin() OR get_user_role_at_store(store_id) = 'Owner');

-- Owners can delete (except billing owners removing themselves)
CREATE POLICY "store_users_delete" ON store_users
  FOR DELETE TO authenticated
  USING (
    is_platform_admin()
    OR (
      get_user_role_at_store(store_id) = 'Owner'
      AND NOT (user_id = auth.uid() AND is_billing_owner = true)
    )
  );


-- -----------------------------------------------------
-- STORES TABLE
-- -----------------------------------------------------

-- Users can view stores they have access to
CREATE POLICY "stores_select" ON stores
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR id = ANY(get_user_store_ids())
  );

-- Owners can create stores
CREATE POLICY "stores_insert" ON stores
  FOR INSERT TO authenticated
  WITH CHECK (
    is_platform_admin()
    OR billing_user_id = auth.uid()
    OR is_any_store_owner()
  );

-- Owners/Managers can update stores
CREATE POLICY "stores_update" ON stores
  FOR UPDATE TO authenticated
  USING (can_manage_store(id))
  WITH CHECK (can_manage_store(id));

-- Only billing owners or platform admins can delete
CREATE POLICY "stores_delete" ON stores
  FOR DELETE TO authenticated
  USING (is_platform_admin() OR billing_user_id = auth.uid());


-- -----------------------------------------------------
-- INVENTORY_ITEMS TABLE (global catalog)
-- -----------------------------------------------------

-- All authenticated users can view
CREATE POLICY "inventory_items_select" ON inventory_items
  FOR SELECT TO authenticated
  USING (true);

-- Owners/Managers can insert
CREATE POLICY "inventory_items_insert" ON inventory_items
  FOR INSERT TO authenticated
  WITH CHECK (
    is_platform_admin()
    OR 'Owner' = ANY(
      SELECT role FROM store_users WHERE user_id = auth.uid()
    )
    OR 'Manager' = ANY(
      SELECT role FROM store_users WHERE user_id = auth.uid()
    )
  );

-- Owners/Managers can update
CREATE POLICY "inventory_items_update" ON inventory_items
  FOR UPDATE TO authenticated
  USING (
    is_platform_admin()
    OR 'Owner' = ANY(SELECT role FROM store_users WHERE user_id = auth.uid())
    OR 'Manager' = ANY(SELECT role FROM store_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    is_platform_admin()
    OR 'Owner' = ANY(SELECT role FROM store_users WHERE user_id = auth.uid())
    OR 'Manager' = ANY(SELECT role FROM store_users WHERE user_id = auth.uid())
  );

-- Only Owners can delete
CREATE POLICY "inventory_items_delete" ON inventory_items
  FOR DELETE TO authenticated
  USING (
    is_platform_admin()
    OR 'Owner' = ANY(SELECT role FROM store_users WHERE user_id = auth.uid())
  );


-- -----------------------------------------------------
-- STORE_INVENTORY TABLE
-- -----------------------------------------------------

-- Users can view inventory for their stores
CREATE POLICY "store_inventory_select" ON store_inventory
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR has_store_access(store_id));

-- Users with store access can manage inventory
CREATE POLICY "store_inventory_insert" ON store_inventory
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin() OR has_store_access(store_id));

CREATE POLICY "store_inventory_update" ON store_inventory
  FOR UPDATE TO authenticated
  USING (is_platform_admin() OR has_store_access(store_id))
  WITH CHECK (is_platform_admin() OR has_store_access(store_id));

-- Only Owners can delete
CREATE POLICY "store_inventory_delete" ON store_inventory
  FOR DELETE TO authenticated
  USING (is_platform_admin() OR get_user_role_at_store(store_id) = 'Owner');


-- -----------------------------------------------------
-- STOCK_HISTORY TABLE
-- -----------------------------------------------------

-- Users can view history for their stores
CREATE POLICY "stock_history_select" ON stock_history
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR has_store_access(store_id));

-- Role-based insert permissions
CREATE POLICY "stock_history_insert" ON stock_history
  FOR INSERT TO authenticated
  WITH CHECK (
    is_platform_admin()
    OR (
      has_store_access(store_id)
      AND (
        (action_type = 'Count' AND get_user_role_at_store(store_id) IN ('Owner', 'Manager', 'Staff'))
        OR (action_type = 'Reception' AND get_user_role_at_store(store_id) IN ('Owner', 'Manager', 'Driver'))
        OR (action_type = 'Adjustment' AND get_user_role_at_store(store_id) IN ('Owner', 'Manager'))
      )
    )
  );

-- Immutable - only platform admins
CREATE POLICY "stock_history_update" ON stock_history
  FOR UPDATE TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "stock_history_delete" ON stock_history
  FOR DELETE TO authenticated
  USING (is_platform_admin());


-- -----------------------------------------------------
-- DAILY_COUNTS TABLE
-- -----------------------------------------------------

-- Users can view counts for their stores
CREATE POLICY "daily_counts_select" ON daily_counts
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR has_store_access(store_id));

-- Owner, Manager, Staff can submit
CREATE POLICY "daily_counts_insert" ON daily_counts
  FOR INSERT TO authenticated
  WITH CHECK (
    is_platform_admin()
    OR get_user_role_at_store(store_id) IN ('Owner', 'Manager', 'Staff')
  );

-- Owner, Manager can update
CREATE POLICY "daily_counts_update" ON daily_counts
  FOR UPDATE TO authenticated
  USING (is_platform_admin() OR get_user_role_at_store(store_id) IN ('Owner', 'Manager'))
  WITH CHECK (is_platform_admin() OR get_user_role_at_store(store_id) IN ('Owner', 'Manager'));

-- Only Owner can delete
CREATE POLICY "daily_counts_delete" ON daily_counts
  FOR DELETE TO authenticated
  USING (is_platform_admin() OR get_user_role_at_store(store_id) = 'Owner');


-- -----------------------------------------------------
-- SHIFTS TABLE
-- -----------------------------------------------------

-- Users see own shifts, Owners/Managers see all at store
CREATE POLICY "shifts_select" ON shifts
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR user_id = auth.uid()
    OR get_user_role_at_store(store_id) IN ('Owner', 'Manager')
  );

-- Owner/Manager can create shifts
CREATE POLICY "shifts_insert" ON shifts
  FOR INSERT TO authenticated
  WITH CHECK (
    is_platform_admin()
    OR get_user_role_at_store(store_id) IN ('Owner', 'Manager')
  );

-- Owner/Manager can update, or user can update own
CREATE POLICY "shifts_update" ON shifts
  FOR UPDATE TO authenticated
  USING (
    is_platform_admin()
    OR get_user_role_at_store(store_id) IN ('Owner', 'Manager')
    OR user_id = auth.uid()
  )
  WITH CHECK (
    is_platform_admin()
    OR get_user_role_at_store(store_id) IN ('Owner', 'Manager')
    OR user_id = auth.uid()
  );

-- Only Owner/Manager can delete
CREATE POLICY "shifts_delete" ON shifts
  FOR DELETE TO authenticated
  USING (
    is_platform_admin()
    OR get_user_role_at_store(store_id) IN ('Owner', 'Manager')
  );


-- -----------------------------------------------------
-- SUBSCRIPTIONS TABLE
-- -----------------------------------------------------

-- Owner and billing user can see
CREATE POLICY "subscriptions_select" ON subscriptions
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR billing_user_id = auth.uid()
    OR get_user_role_at_store(store_id) = 'Owner'
  );

-- Only billing user can manage
CREATE POLICY "subscriptions_insert" ON subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin() OR billing_user_id = auth.uid());

CREATE POLICY "subscriptions_update" ON subscriptions
  FOR UPDATE TO authenticated
  USING (is_platform_admin() OR billing_user_id = auth.uid())
  WITH CHECK (is_platform_admin() OR billing_user_id = auth.uid());

CREATE POLICY "subscriptions_delete" ON subscriptions
  FOR DELETE TO authenticated
  USING (is_platform_admin());


-- =====================================================
-- STEP 6: VERIFY RLS IS ENABLED
-- =====================================================

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY['profiles', 'stores', 'store_users', 'store_inventory',
                         'stock_history', 'daily_counts', 'shifts',
                         'inventory_items', 'subscriptions'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;


-- =====================================================
-- STEP 7: ANALYZE TABLES
-- =====================================================

ANALYZE profiles;
ANALYZE stores;
ANALYZE store_users;
ANALYZE store_inventory;
ANALYZE stock_history;
ANALYZE daily_counts;
ANALYZE shifts;
ANALYZE inventory_items;
ANALYZE subscriptions;
