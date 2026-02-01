-- Migration: Add phone number to profiles
-- Description: Store phone numbers captured during user onboarding

-- Add phone column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- Index for phone lookups (if needed for contact search)
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone) WHERE phone IS NOT NULL;
