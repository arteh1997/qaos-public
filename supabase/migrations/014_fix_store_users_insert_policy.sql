-- Migration: Fix store_users insert policy for new store creation
--
-- Problem: When creating a new store, the user needs to add themselves to store_users
-- as Owner, but the current policy requires them to already be an Owner at that store.
-- This is a chicken-and-egg problem.
--
-- Solution: Allow users to insert themselves into store_users if they are the
-- billing_user_id of the store (i.e., they own the store).

-- Drop the existing insert policy
DROP POLICY IF EXISTS "store_users_insert_policy" ON store_users;

-- Create updated insert policy that allows:
-- 1. Platform admins can insert anyone
-- 2. Existing Owners at the store can invite others
-- 3. Users can add themselves to stores they own (billing_user_id)
CREATE POLICY "store_users_insert_policy" ON store_users
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_platform_admin())
    OR (SELECT get_user_role_at_store(store_id)) = 'Owner'
    OR (
      -- Allow users to add themselves to stores they own (billing owner)
      user_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM stores
        WHERE stores.id = store_users.store_id
        AND stores.billing_user_id = (SELECT auth.uid())
      )
    )
  );

-- Also fix the stores insert policy to allow any authenticated user to create
-- their first store (for onboarding)
DROP POLICY IF EXISTS "stores_insert_policy" ON stores;

CREATE POLICY "stores_insert_policy" ON stores
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_platform_admin())
    OR billing_user_id = (SELECT auth.uid())  -- User is setting themselves as billing owner
  );
