-- Migration: Update Role Constraint
-- Description: Update profiles.role check constraint to allow new multi-tenant roles
--              (Owner, Manager, Staff, Driver) while keeping backward compatibility with Admin

-- ============================================================================
-- 1. Drop old constraint and add new one
-- ============================================================================

-- Drop the existing role check constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add new constraint that allows both old and new roles during transition
-- Old: Admin, Staff, Driver
-- New: Owner, Manager, Staff, Driver
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('Admin', 'Owner', 'Manager', 'Staff', 'Driver'));

-- ============================================================================
-- 2. Migrate existing Admin users to Owner role in profiles table
-- ============================================================================
-- This keeps profiles.role in sync with the new role system
-- Note: The store_users table already has the correct roles from migration 005

UPDATE profiles
SET role = 'Owner', updated_at = now()
WHERE role = 'Admin';

-- ============================================================================
-- 3. After migration is complete and verified, you can optionally remove Admin
--    by running this manually:
-- ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
-- ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
--   CHECK (role IN ('Owner', 'Manager', 'Staff', 'Driver'));
-- ============================================================================
