-- =====================================================
-- FIX RLS POLICY RECURSION
-- Restaurant Inventory Management System
--
-- Purpose: Fix infinite recursion in RLS policies caused by
-- is_platform_admin() querying profiles which has RLS that
-- calls is_platform_admin().
--
-- Solution: Use SECURITY DEFINER functions that bypass RLS
-- and rewrite policies to avoid circular dependencies.
-- =====================================================

-- =====================================================
-- STEP 1: DROP ALL PROBLEMATIC POLICIES FIRST
-- =====================================================

-- Drop profiles policies (these are causing the main issue)
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON profiles;

-- Drop store_users policies
DROP POLICY IF EXISTS "store_users_select_own" ON store_users;
DROP POLICY IF EXISTS "store_users_select_store_members" ON store_users;
DROP POLICY IF EXISTS "store_users_insert_policy" ON store_users;
DROP POLICY IF EXISTS "store_users_update_policy" ON store_users;
DROP POLICY IF EXISTS "store_users_delete_policy" ON store_users;

-- Drop stores policies
DROP POLICY IF EXISTS "stores_select_policy" ON stores;
DROP POLICY IF EXISTS "stores_insert_policy" ON stores;
DROP POLICY IF EXISTS "stores_update_policy" ON stores;
DROP POLICY IF EXISTS "stores_delete_policy" ON stores;

-- Drop store_inventory policies
DROP POLICY IF EXISTS "store_inventory_select_policy" ON store_inventory;
DROP POLICY IF EXISTS "store_inventory_insert_policy" ON store_inventory;
DROP POLICY IF EXISTS "store_inventory_update_policy" ON store_inventory;
DROP POLICY IF EXISTS "store_inventory_delete_policy" ON store_inventory;

-- Drop stock_history policies
DROP POLICY IF EXISTS "stock_history_select_policy" ON stock_history;
DROP POLICY IF EXISTS "stock_history_insert_policy" ON stock_history;
DROP POLICY IF EXISTS "stock_history_update_policy" ON stock_history;
DROP POLICY IF EXISTS "stock_history_delete_policy" ON stock_history;

-- Drop daily_counts policies
DROP POLICY IF EXISTS "daily_counts_select_policy" ON daily_counts;
DROP POLICY IF EXISTS "daily_counts_insert_policy" ON daily_counts;
DROP POLICY IF EXISTS "daily_counts_update_policy" ON daily_counts;
DROP POLICY IF EXISTS "daily_counts_delete_policy" ON daily_counts;

-- Drop shifts policies
DROP POLICY IF EXISTS "shifts_select_policy" ON shifts;
DROP POLICY IF EXISTS "shifts_insert_policy" ON shifts;
DROP POLICY IF EXISTS "shifts_update_policy" ON shifts;
DROP POLICY IF EXISTS "shifts_delete_policy" ON shifts;

-- Drop subscriptions policies
DROP POLICY IF EXISTS "subscriptions_select_policy" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_insert_policy" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_update_policy" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_delete_policy" ON subscriptions;

-- Drop inventory_items policies
DROP POLICY IF EXISTS "inventory_items_select_policy" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_insert_policy" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_update_policy" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_delete_policy" ON inventory_items;


-- =====================================================
-- STEP 2: CREATE BYPASS RLS HELPER FUNCTIONS
-- These use SECURITY DEFINER to bypass RLS and avoid recursion
-- =====================================================

-- Drop and recreate is_platform_admin with explicit RLS bypass
DROP FUNCTION IF EXISTS is_platform_admin();
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Direct query bypasses RLS due to SECURITY DEFINER
  SELECT COALESCE(is_platform_admin, false)
  INTO v_is_admin
  FROM profiles
  WHERE id = auth.uid();

  RETURN COALESCE(v_is_admin, false);
END;
$$;

-- Drop and recreate get_user_store_ids to be safe
DROP FUNCTION IF EXISTS get_user_store_ids();
CREATE OR REPLACE FUNCTION get_user_store_ids()
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_ids UUID[];
BEGIN
  SELECT COALESCE(array_agg(store_id), '{}'::UUID[])
  INTO v_store_ids
  FROM store_users
  WHERE user_id = auth.uid();

  RETURN v_store_ids;
END;
$$;

-- Drop and recreate get_user_role_at_store to be safe
DROP FUNCTION IF EXISTS get_user_role_at_store(UUID);
CREATE OR REPLACE FUNCTION get_user_role_at_store(p_store_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role
  INTO v_role
  FROM store_users
  WHERE user_id = auth.uid()
    AND store_id = p_store_id;

  RETURN v_role;
END;
$$;

-- Drop and recreate has_store_access to be safe
DROP FUNCTION IF EXISTS has_store_access(UUID);
CREATE OR REPLACE FUNCTION has_store_access(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_access BOOLEAN;
BEGIN
  -- Check platform admin first
  IF is_platform_admin() THEN
    RETURN true;
  END IF;

  -- Check store_users membership
  SELECT EXISTS (
    SELECT 1 FROM store_users
    WHERE user_id = auth.uid()
      AND store_id = p_store_id
  ) INTO v_has_access;

  RETURN COALESCE(v_has_access, false);
END;
$$;

-- Drop and recreate can_manage_store to be safe
DROP FUNCTION IF EXISTS can_manage_store(UUID);
CREATE OR REPLACE FUNCTION can_manage_store(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can_manage BOOLEAN;
BEGIN
  -- Check platform admin first
  IF is_platform_admin() THEN
    RETURN true;
  END IF;

  -- Check if user is Owner or Manager at this store
  SELECT EXISTS (
    SELECT 1 FROM store_users
    WHERE user_id = auth.uid()
      AND store_id = p_store_id
      AND role IN ('Owner', 'Manager')
  ) INTO v_can_manage;

  RETURN COALESCE(v_can_manage, false);
END;
$$;

-- Drop and recreate is_any_store_owner to be safe
DROP FUNCTION IF EXISTS is_any_store_owner();
CREATE OR REPLACE FUNCTION is_any_store_owner()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_owner BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM store_users
    WHERE user_id = auth.uid()
      AND role = 'Owner'
  ) INTO v_is_owner;

  RETURN COALESCE(v_is_owner, false);
END;
$$;


-- =====================================================
-- STEP 3: RECREATE RLS POLICIES (NON-RECURSIVE)
-- =====================================================

-- -----------------------------------------------------
-- PROFILES TABLE - Simple, non-recursive policies
-- -----------------------------------------------------

-- Users can always see their own profile
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Owners/Managers can see profiles of users at shared stores
-- This policy uses SECURITY DEFINER function to avoid recursion
CREATE POLICY "profiles_select_shared_stores" ON profiles
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM store_users my_su
      INNER JOIN store_users their_su ON my_su.store_id = their_su.store_id
      WHERE my_su.user_id = auth.uid()
        AND my_su.role IN ('Owner', 'Manager')
        AND their_su.user_id = profiles.id
    )
  );

-- Platform admins and Owners can create profiles (for inviting users)
CREATE POLICY "profiles_insert_policy" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    is_platform_admin()
    OR is_any_store_owner()
  );

-- Users can update their own profile
CREATE POLICY "profiles_update_policy" ON profiles
  FOR UPDATE TO authenticated
  USING (is_platform_admin() OR id = auth.uid())
  WITH CHECK (is_platform_admin() OR id = auth.uid());

-- Only platform admins can delete profiles
CREATE POLICY "profiles_delete_policy" ON profiles
  FOR DELETE TO authenticated
  USING (is_platform_admin());


-- -----------------------------------------------------
-- STORE_USERS TABLE - Junction table policies
-- -----------------------------------------------------

-- Users can see their own memberships
CREATE POLICY "store_users_select_own" ON store_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Owners and Managers can see all members of their stores
CREATE POLICY "store_users_select_store_members" ON store_users
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM store_users su
      WHERE su.user_id = auth.uid()
        AND su.store_id = store_users.store_id
        AND su.role IN ('Owner', 'Manager')
    )
  );

-- Only Owners can invite users to stores
CREATE POLICY "store_users_insert_policy" ON store_users
  FOR INSERT TO authenticated
  WITH CHECK (
    is_platform_admin()
    OR get_user_role_at_store(store_id) = 'Owner'
  );

-- Owners can update roles
CREATE POLICY "store_users_update_policy" ON store_users
  FOR UPDATE TO authenticated
  USING (is_platform_admin() OR get_user_role_at_store(store_id) = 'Owner')
  WITH CHECK (is_platform_admin() OR get_user_role_at_store(store_id) = 'Owner');

-- Owners can remove users (but not themselves if billing owner)
CREATE POLICY "store_users_delete_policy" ON store_users
  FOR DELETE TO authenticated
  USING (
    is_platform_admin()
    OR (
      get_user_role_at_store(store_id) = 'Owner'
      AND NOT (user_id = auth.uid() AND is_billing_owner = true)
    )
  );


-- -----------------------------------------------------
-- STORES TABLE - Store access policies
-- -----------------------------------------------------

-- Users can view stores they have access to via store_users
CREATE POLICY "stores_select_policy" ON stores
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM store_users
      WHERE store_users.user_id = auth.uid()
        AND store_users.store_id = stores.id
    )
  );

-- Owners can create stores
CREATE POLICY "stores_insert_policy" ON stores
  FOR INSERT TO authenticated
  WITH CHECK (
    is_platform_admin()
    OR billing_user_id = auth.uid()
    OR is_any_store_owner()
  );

-- Owners and Managers can update their stores
CREATE POLICY "stores_update_policy" ON stores
  FOR UPDATE TO authenticated
  USING (can_manage_store(id))
  WITH CHECK (can_manage_store(id));

-- Only billing owners can delete stores
CREATE POLICY "stores_delete_policy" ON stores
  FOR DELETE TO authenticated
  USING (is_platform_admin() OR billing_user_id = auth.uid());


-- -----------------------------------------------------
-- INVENTORY ITEMS TABLE - Global catalog policies
-- -----------------------------------------------------

-- All authenticated users can view inventory items
CREATE POLICY "inventory_items_select_policy" ON inventory_items
  FOR SELECT TO authenticated
  USING (true);

-- Owners and Managers can manage inventory items
CREATE POLICY "inventory_items_insert_policy" ON inventory_items
  FOR INSERT TO authenticated
  WITH CHECK (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM store_users
      WHERE user_id = auth.uid()
        AND role IN ('Owner', 'Manager')
    )
  );

CREATE POLICY "inventory_items_update_policy" ON inventory_items
  FOR UPDATE TO authenticated
  USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM store_users
      WHERE user_id = auth.uid()
        AND role IN ('Owner', 'Manager')
    )
  )
  WITH CHECK (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM store_users
      WHERE user_id = auth.uid()
        AND role IN ('Owner', 'Manager')
    )
  );

CREATE POLICY "inventory_items_delete_policy" ON inventory_items
  FOR DELETE TO authenticated
  USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM store_users
      WHERE user_id = auth.uid()
        AND role = 'Owner'
    )
  );


-- -----------------------------------------------------
-- STORE INVENTORY TABLE - Store-scoped inventory
-- -----------------------------------------------------

-- Users can view inventory for stores they have access to
CREATE POLICY "store_inventory_select_policy" ON store_inventory
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR has_store_access(store_id));

-- Users with store access can manage store inventory
CREATE POLICY "store_inventory_insert_policy" ON store_inventory
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin() OR has_store_access(store_id));

CREATE POLICY "store_inventory_update_policy" ON store_inventory
  FOR UPDATE TO authenticated
  USING (is_platform_admin() OR has_store_access(store_id))
  WITH CHECK (is_platform_admin() OR has_store_access(store_id));

-- Only Owners can delete store inventory records
CREATE POLICY "store_inventory_delete_policy" ON store_inventory
  FOR DELETE TO authenticated
  USING (is_platform_admin() OR get_user_role_at_store(store_id) = 'Owner');


-- -----------------------------------------------------
-- STOCK HISTORY TABLE - Stock transaction history
-- -----------------------------------------------------

-- Users can view history for stores they have access to
CREATE POLICY "stock_history_select_policy" ON stock_history
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR has_store_access(store_id));

-- Users with store access can create history records based on role and action type
CREATE POLICY "stock_history_insert_policy" ON stock_history
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

-- Stock history is immutable (only platform admins can modify)
CREATE POLICY "stock_history_update_policy" ON stock_history
  FOR UPDATE TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "stock_history_delete_policy" ON stock_history
  FOR DELETE TO authenticated
  USING (is_platform_admin());


-- -----------------------------------------------------
-- DAILY COUNTS TABLE - Daily count records
-- -----------------------------------------------------

-- Users can view counts for stores they have access to
CREATE POLICY "daily_counts_select_policy" ON daily_counts
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR has_store_access(store_id));

-- Owner, Manager, Staff can submit daily counts
CREATE POLICY "daily_counts_insert_policy" ON daily_counts
  FOR INSERT TO authenticated
  WITH CHECK (
    is_platform_admin()
    OR get_user_role_at_store(store_id) IN ('Owner', 'Manager', 'Staff')
  );

CREATE POLICY "daily_counts_update_policy" ON daily_counts
  FOR UPDATE TO authenticated
  USING (is_platform_admin() OR get_user_role_at_store(store_id) IN ('Owner', 'Manager'))
  WITH CHECK (is_platform_admin() OR get_user_role_at_store(store_id) IN ('Owner', 'Manager'));

CREATE POLICY "daily_counts_delete_policy" ON daily_counts
  FOR DELETE TO authenticated
  USING (is_platform_admin() OR get_user_role_at_store(store_id) = 'Owner');


-- -----------------------------------------------------
-- SHIFTS TABLE - User shift/clock records
-- -----------------------------------------------------

-- Users can see their own shifts, Owners/Managers see all at their stores
CREATE POLICY "shifts_select_policy" ON shifts
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR user_id = auth.uid()
    OR get_user_role_at_store(store_id) IN ('Owner', 'Manager')
  );

-- Only Owners and Managers can create shifts
CREATE POLICY "shifts_insert_policy" ON shifts
  FOR INSERT TO authenticated
  WITH CHECK (
    is_platform_admin()
    OR get_user_role_at_store(store_id) IN ('Owner', 'Manager')
  );

-- Owners/Managers can update shifts, users can update their own (clock in/out)
CREATE POLICY "shifts_update_policy" ON shifts
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

-- Only Owners and Managers can delete shifts
CREATE POLICY "shifts_delete_policy" ON shifts
  FOR DELETE TO authenticated
  USING (
    is_platform_admin()
    OR get_user_role_at_store(store_id) IN ('Owner', 'Manager')
  );


-- -----------------------------------------------------
-- SUBSCRIPTIONS TABLE - Billing subscriptions
-- -----------------------------------------------------

-- Owners and billing users can see subscriptions
CREATE POLICY "subscriptions_select_policy" ON subscriptions
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR billing_user_id = auth.uid()
    OR get_user_role_at_store(store_id) = 'Owner'
  );

-- Only billing users can manage subscriptions
CREATE POLICY "subscriptions_insert_policy" ON subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin() OR billing_user_id = auth.uid());

CREATE POLICY "subscriptions_update_policy" ON subscriptions
  FOR UPDATE TO authenticated
  USING (is_platform_admin() OR billing_user_id = auth.uid())
  WITH CHECK (is_platform_admin() OR billing_user_id = auth.uid());

CREATE POLICY "subscriptions_delete_policy" ON subscriptions
  FOR DELETE TO authenticated
  USING (is_platform_admin());


-- =====================================================
-- STEP 4: GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION is_platform_admin TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_store_ids TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role_at_store TO authenticated;
GRANT EXECUTE ON FUNCTION has_store_access TO authenticated;
GRANT EXECUTE ON FUNCTION can_manage_store TO authenticated;
GRANT EXECUTE ON FUNCTION is_any_store_owner TO authenticated;


-- =====================================================
-- STEP 5: ANALYZE TABLES
-- =====================================================

ANALYZE profiles;
ANALYZE stores;
ANALYZE store_users;
ANALYZE store_inventory;
ANALYZE stock_history;
ANALYZE shifts;
ANALYZE daily_counts;
ANALYZE inventory_items;
ANALYZE subscriptions;
