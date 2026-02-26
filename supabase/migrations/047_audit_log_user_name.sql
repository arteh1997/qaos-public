-- Add user_name column to audit_logs for display purposes
-- This avoids needing to join with profiles every time we render the activity log
ALTER TABLE audit_logs ADD COLUMN user_name TEXT;

-- Backfill existing entries from profiles
UPDATE audit_logs al
SET user_name = p.full_name
FROM profiles p
WHERE al.user_id = p.id
  AND al.user_name IS NULL
  AND p.full_name IS NOT NULL;