-- =====================================================
-- MULTI-TENANT RLS MIGRATION
-- Restaurant Inventory Management System
--
-- Purpose: Update RLS policies to use store_users junction table
-- for multi-tenant store-level access control.
--
-- New role hierarchy: Owner, Manager, Staff, Driver
-- =====================================================

-- =====================================================
-- SECTION 1: NEW HELPER FUNCTIONS
-- =====================================================

-- Get all store IDs user has access to
CREATE OR REPLACE FUNCTION get_user_store_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(store_id),
    '{}'::UUID[]
  )
  FROM store_users
  WHERE user_id = (SELECT auth.uid());
$$;

-- Get user's role at a specific store
CREATE OR REPLACE FUNCTION get_user_role_at_store(p_store_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM store_users
  WHERE user_id = (SELECT auth.uid())
    AND store_id = p_store_id;
$$;

-- Check if user is platform admin (super-admin)
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM profiles WHERE id = (SELECT auth.uid())),
    false
  );
$$;

-- Check if user can manage a specific store (Owner or Manager)
CREATE OR REPLACE FUNCTION can_manage_store(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM store_users
    WHERE user_id = (SELECT auth.uid())
      AND store_id = p_store_id
      AND role IN ('Owner', 'Manager')
  ) OR (SELECT is_platform_admin());
$$;

-- Check if user is any store's owner
CREATE OR REPLACE FUNCTION is_any_store_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM store_users
    WHERE user_id = (SELECT auth.uid())
      AND role = 'Owner'
  );
$$;

-- Check if user has access to a specific store
CREATE OR REPLACE FUNCTION has_store_access(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM store_users
    WHERE user_id = (SELECT auth.uid())
      AND store_id = p_store_id
  ) OR (SELECT is_platform_admin());
$$;

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION get_user_store_ids TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role_at_store TO authenticated;
GRANT EXECUTE ON FUNCTION is_platform_admin TO authenticated;
GRANT EXECUTE ON FUNCTION can_manage_store TO authenticated;
GRANT EXECUTE ON FUNCTION is_any_store_owner TO authenticated;
GRANT EXECUTE ON FUNCTION has_store_access TO authenticated;


-- =====================================================
-- SECTION 2: STORE_USERS TABLE RLS POLICIES
-- =====================================================

-- Users can see their own memberships
CREATE POLICY "store_users_select_own" ON store_users
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Owners and Managers can see all members of their stores
CREATE POLICY "store_users_select_store_members" ON store_users
  FOR SELECT TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR EXISTS (
      SELECT 1 FROM store_users su
      WHERE su.user_id = (SELECT auth.uid())
        AND su.store_id = store_users.store_id
        AND su.role IN ('Owner', 'Manager')
    )
  );

-- Only Owners can invite users to stores
CREATE POLICY "store_users_insert_policy" ON store_users
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_platform_admin())
    OR (SELECT get_user_role_at_store(store_id)) = 'Owner'
  );

-- Owners can update roles
CREATE POLICY "store_users_update_policy" ON store_users
  FOR UPDATE TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR (SELECT get_user_role_at_store(store_id)) = 'Owner'
  )
  WITH CHECK (
    (SELECT is_platform_admin())
    OR (SELECT get_user_role_at_store(store_id)) = 'Owner'
  );

-- Owners can remove users (but not themselves if they're the billing owner)
CREATE POLICY "store_users_delete_policy" ON store_users
  FOR DELETE TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR (
      (SELECT get_user_role_at_store(store_id)) = 'Owner'
      AND NOT (user_id = (SELECT auth.uid()) AND is_billing_owner = true)
    )
  );


-- =====================================================
-- SECTION 3: SUBSCRIPTIONS TABLE RLS POLICIES
-- =====================================================

-- Owners and billing users can see subscriptions
CREATE POLICY "subscriptions_select_policy" ON subscriptions
  FOR SELECT TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR billing_user_id = (SELECT auth.uid())
    OR (SELECT get_user_role_at_store(store_id)) = 'Owner'
  );

-- Only billing users can manage subscriptions
CREATE POLICY "subscriptions_insert_policy" ON subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_platform_admin())
    OR billing_user_id = (SELECT auth.uid())
  );

CREATE POLICY "subscriptions_update_policy" ON subscriptions
  FOR UPDATE TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR billing_user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    (SELECT is_platform_admin())
    OR billing_user_id = (SELECT auth.uid())
  );

CREATE POLICY "subscriptions_delete_policy" ON subscriptions
  FOR DELETE TO authenticated
  USING ((SELECT is_platform_admin()));


-- =====================================================
-- SECTION 4: UPDATE EXISTING TABLE RLS POLICIES
-- =====================================================

-- -----------------------------------------------------
-- STORES TABLE - Updated policies
-- -----------------------------------------------------

DROP POLICY IF EXISTS "stores_select_policy" ON stores;
DROP POLICY IF EXISTS "stores_insert_policy" ON stores;
DROP POLICY IF EXISTS "stores_update_policy" ON stores;
DROP POLICY IF EXISTS "stores_delete_policy" ON stores;

-- Users can view stores they have access to via store_users
CREATE POLICY "stores_select_policy" ON stores
  FOR SELECT TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR EXISTS (
      SELECT 1 FROM store_users
      WHERE store_users.user_id = (SELECT auth.uid())
        AND store_users.store_id = stores.id
    )
  );

-- Owners can create stores
CREATE POLICY "stores_insert_policy" ON stores
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_platform_admin())
    OR billing_user_id = (SELECT auth.uid())
    OR (SELECT is_any_store_owner())
  );

-- Owners and Managers can update their stores
CREATE POLICY "stores_update_policy" ON stores
  FOR UPDATE TO authenticated
  USING ((SELECT can_manage_store(id)))
  WITH CHECK ((SELECT can_manage_store(id)));

-- Only billing owners can delete stores
CREATE POLICY "stores_delete_policy" ON stores
  FOR DELETE TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR billing_user_id = (SELECT auth.uid())
  );


-- -----------------------------------------------------
-- PROFILES TABLE - Updated policies
-- -----------------------------------------------------

DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON profiles;

-- Users can see their own profile and profiles at shared stores
CREATE POLICY "profiles_select_policy" ON profiles
  FOR SELECT TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM store_users my_stores
      INNER JOIN store_users their_stores ON my_stores.store_id = their_stores.store_id
      WHERE my_stores.user_id = (SELECT auth.uid())
        AND my_stores.role IN ('Owner', 'Manager')
        AND their_stores.user_id = profiles.id
    )
  );

-- Platform admins and Owners can create profiles
CREATE POLICY "profiles_insert_policy" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_platform_admin())
    OR (SELECT is_any_store_owner())
  );

-- Users can update their own profile
CREATE POLICY "profiles_update_policy" ON profiles
  FOR UPDATE TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR id = (SELECT auth.uid())
  )
  WITH CHECK (
    (SELECT is_platform_admin())
    OR id = (SELECT auth.uid())
  );

-- Only platform admins can delete profiles
CREATE POLICY "profiles_delete_policy" ON profiles
  FOR DELETE TO authenticated
  USING ((SELECT is_platform_admin()));


-- -----------------------------------------------------
-- INVENTORY ITEMS TABLE - Updated policies
-- -----------------------------------------------------

DROP POLICY IF EXISTS "inventory_items_select_policy" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_insert_policy" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_update_policy" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_delete_policy" ON inventory_items;

-- All authenticated users can view inventory items
CREATE POLICY "inventory_items_select_policy" ON inventory_items
  FOR SELECT TO authenticated
  USING (true);

-- Owners and Managers can manage inventory items
CREATE POLICY "inventory_items_insert_policy" ON inventory_items
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_platform_admin())
    OR EXISTS (
      SELECT 1 FROM store_users
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Owner', 'Manager')
    )
  );

CREATE POLICY "inventory_items_update_policy" ON inventory_items
  FOR UPDATE TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR EXISTS (
      SELECT 1 FROM store_users
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Owner', 'Manager')
    )
  )
  WITH CHECK (
    (SELECT is_platform_admin())
    OR EXISTS (
      SELECT 1 FROM store_users
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Owner', 'Manager')
    )
  );

CREATE POLICY "inventory_items_delete_policy" ON inventory_items
  FOR DELETE TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR EXISTS (
      SELECT 1 FROM store_users
      WHERE user_id = (SELECT auth.uid())
        AND role = 'Owner'
    )
  );


-- -----------------------------------------------------
-- STORE INVENTORY TABLE - Updated policies
-- -----------------------------------------------------

DROP POLICY IF EXISTS "store_inventory_select_policy" ON store_inventory;
DROP POLICY IF EXISTS "store_inventory_insert_policy" ON store_inventory;
DROP POLICY IF EXISTS "store_inventory_update_policy" ON store_inventory;
DROP POLICY IF EXISTS "store_inventory_delete_policy" ON store_inventory;

-- Users can view inventory for stores they have access to
CREATE POLICY "store_inventory_select_policy" ON store_inventory
  FOR SELECT TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR (SELECT has_store_access(store_id))
  );

-- Users with store access can manage store inventory
CREATE POLICY "store_inventory_insert_policy" ON store_inventory
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_platform_admin())
    OR (SELECT has_store_access(store_id))
  );

CREATE POLICY "store_inventory_update_policy" ON store_inventory
  FOR UPDATE TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR (SELECT has_store_access(store_id))
  )
  WITH CHECK (
    (SELECT is_platform_admin())
    OR (SELECT has_store_access(store_id))
  );

-- Only Owners can delete store inventory records
CREATE POLICY "store_inventory_delete_policy" ON store_inventory
  FOR DELETE TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR (SELECT get_user_role_at_store(store_id)) = 'Owner'
  );


-- -----------------------------------------------------
-- STOCK HISTORY TABLE - Updated policies
-- -----------------------------------------------------

DROP POLICY IF EXISTS "stock_history_select_policy" ON stock_history;
DROP POLICY IF EXISTS "stock_history_insert_policy" ON stock_history;
DROP POLICY IF EXISTS "stock_history_update_policy" ON stock_history;
DROP POLICY IF EXISTS "stock_history_delete_policy" ON stock_history;

-- Users can view history for stores they have access to
CREATE POLICY "stock_history_select_policy" ON stock_history
  FOR SELECT TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR (SELECT has_store_access(store_id))
  );

-- Users with store access can create history records based on role
CREATE POLICY "stock_history_insert_policy" ON stock_history
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_platform_admin())
    OR (
      (SELECT has_store_access(store_id))
      AND (
        (action_type = 'Count' AND (SELECT get_user_role_at_store(store_id)) IN ('Owner', 'Manager', 'Staff'))
        OR (action_type = 'Reception' AND (SELECT get_user_role_at_store(store_id)) IN ('Owner', 'Manager', 'Driver'))
        OR (action_type = 'Adjustment' AND (SELECT get_user_role_at_store(store_id)) IN ('Owner', 'Manager'))
      )
    )
  );

-- Stock history is immutable
CREATE POLICY "stock_history_update_policy" ON stock_history
  FOR UPDATE TO authenticated
  USING ((SELECT is_platform_admin()))
  WITH CHECK ((SELECT is_platform_admin()));

CREATE POLICY "stock_history_delete_policy" ON stock_history
  FOR DELETE TO authenticated
  USING ((SELECT is_platform_admin()));


-- -----------------------------------------------------
-- DAILY COUNTS TABLE - Updated policies
-- -----------------------------------------------------

DROP POLICY IF EXISTS "daily_counts_select_policy" ON daily_counts;
DROP POLICY IF EXISTS "daily_counts_insert_policy" ON daily_counts;
DROP POLICY IF EXISTS "daily_counts_update_policy" ON daily_counts;
DROP POLICY IF EXISTS "daily_counts_delete_policy" ON daily_counts;

-- Users can view counts for stores they have access to
CREATE POLICY "daily_counts_select_policy" ON daily_counts
  FOR SELECT TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR (SELECT has_store_access(store_id))
  );

-- Owner, Manager, Staff can submit daily counts
CREATE POLICY "daily_counts_insert_policy" ON daily_counts
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_platform_admin())
    OR (SELECT get_user_role_at_store(store_id)) IN ('Owner', 'Manager', 'Staff')
  );

CREATE POLICY "daily_counts_update_policy" ON daily_counts
  FOR UPDATE TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR (SELECT get_user_role_at_store(store_id)) IN ('Owner', 'Manager')
  )
  WITH CHECK (
    (SELECT is_platform_admin())
    OR (SELECT get_user_role_at_store(store_id)) IN ('Owner', 'Manager')
  );

CREATE POLICY "daily_counts_delete_policy" ON daily_counts
  FOR DELETE TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR (SELECT get_user_role_at_store(store_id)) = 'Owner'
  );


-- -----------------------------------------------------
-- SHIFTS TABLE - Updated policies
-- -----------------------------------------------------

DROP POLICY IF EXISTS "shifts_select_policy" ON shifts;
DROP POLICY IF EXISTS "shifts_insert_policy" ON shifts;
DROP POLICY IF EXISTS "shifts_update_policy" ON shifts;
DROP POLICY IF EXISTS "shifts_delete_policy" ON shifts;

-- Users can see their own shifts, Owners/Managers see all at their stores
CREATE POLICY "shifts_select_policy" ON shifts
  FOR SELECT TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR user_id = (SELECT auth.uid())
    OR (SELECT get_user_role_at_store(store_id)) IN ('Owner', 'Manager')
  );

-- Only Owners and Managers can create shifts
CREATE POLICY "shifts_insert_policy" ON shifts
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_platform_admin())
    OR (SELECT get_user_role_at_store(store_id)) IN ('Owner', 'Manager')
  );

-- Owners/Managers can update shifts, users can update their own (clock in/out)
CREATE POLICY "shifts_update_policy" ON shifts
  FOR UPDATE TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR (SELECT get_user_role_at_store(store_id)) IN ('Owner', 'Manager')
    OR user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    (SELECT is_platform_admin())
    OR (SELECT get_user_role_at_store(store_id)) IN ('Owner', 'Manager')
    OR user_id = (SELECT auth.uid())
  );

-- Only Owners and Managers can delete shifts
CREATE POLICY "shifts_delete_policy" ON shifts
  FOR DELETE TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR (SELECT get_user_role_at_store(store_id)) IN ('Owner', 'Manager')
  );


-- =====================================================
-- SECTION 5: ANALYZE TABLES
-- =====================================================

ANALYZE stores;
ANALYZE profiles;
ANALYZE inventory_items;
ANALYZE store_inventory;
ANALYZE stock_history;
ANALYZE shifts;
ANALYZE daily_counts;
ANALYZE store_users;
ANALYZE subscriptions;


-- =====================================================
-- SECTION 6: DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION get_user_store_ids() IS 'Returns array of store IDs user has access to via store_users';
COMMENT ON FUNCTION get_user_role_at_store(UUID) IS 'Returns user role at a specific store from store_users';
COMMENT ON FUNCTION is_platform_admin() IS 'Returns true if user is a platform super-admin';
COMMENT ON FUNCTION can_manage_store(UUID) IS 'Returns true if user is Owner or Manager at the store';
COMMENT ON FUNCTION has_store_access(UUID) IS 'Returns true if user has any role at the store';

COMMENT ON TABLE store_users IS 'Junction table for multi-tenant store access. Users can have different roles at different stores.';
COMMENT ON TABLE subscriptions IS 'Store subscription/billing information. Stripe integration deferred.';
