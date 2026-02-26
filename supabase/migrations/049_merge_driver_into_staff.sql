-- Migration 049: Merge Driver role into Staff
-- The Driver role is being eliminated. All Driver functionality
-- is now part of the Staff role (3 roles: Owner, Manager, Staff).

-- 1. Migrate existing data
UPDATE store_users SET role = 'Staff' WHERE role = 'Driver';
UPDATE profiles SET role = 'Staff' WHERE role = 'Driver';
UPDATE user_invites SET role = 'Staff' WHERE role = 'Driver';

-- 2. Handle duplicate store_users entries
-- A user who was both Staff and Driver at the same store now has 2 Staff entries.
-- Remove duplicates, keeping the one with the earliest created_at.
DELETE FROM store_users a
USING store_users b
WHERE a.store_id = b.store_id
  AND a.user_id = b.user_id
  AND a.role = b.role
  AND a.created_at > b.created_at;

-- 3. Update CHECK constraints (drop and recreate)
-- store_users (from migration 005)
ALTER TABLE store_users DROP CONSTRAINT IF EXISTS store_users_role_check;
ALTER TABLE store_users ADD CONSTRAINT store_users_role_check
  CHECK (role IN ('Owner', 'Manager', 'Staff'));

-- profiles (from migration 009)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('Admin', 'Owner', 'Manager', 'Staff'));

-- user_invites (from migration 011)
ALTER TABLE user_invites DROP CONSTRAINT IF EXISTS user_invites_role_check;
ALTER TABLE user_invites ADD CONSTRAINT user_invites_role_check
  CHECK (role IN ('Owner', 'Manager', 'Staff'));

-- 4. Update RLS policy for stock_history inserts
-- The current policy checks 'Driver' for Reception action type.
-- Replace with 'Staff' so Staff can do stock receptions.
DROP POLICY IF EXISTS "stock_history_insert" ON stock_history;
CREATE POLICY "stock_history_insert" ON stock_history
  FOR INSERT TO authenticated
  WITH CHECK (
    store_id IN (SELECT store_id FROM store_users WHERE user_id = auth.uid())
    AND (
      (action_type = 'Count' AND get_user_role_at_store(store_id) IN ('Owner', 'Manager', 'Staff'))
      OR (action_type = 'Reception' AND get_user_role_at_store(store_id) IN ('Owner', 'Manager', 'Staff'))
      OR (action_type = 'Adjustment' AND get_user_role_at_store(store_id) IN ('Owner', 'Manager'))
      OR (action_type = 'Waste' AND get_user_role_at_store(store_id) IN ('Owner', 'Manager', 'Staff'))
      OR (action_type = 'Sale' AND get_user_role_at_store(store_id) IN ('Owner', 'Manager'))
    )
  );
