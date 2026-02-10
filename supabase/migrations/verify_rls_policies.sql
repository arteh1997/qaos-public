-- Diagnostic: Check current RLS policies on inventory_items
-- This helps verify if migration 016 was applied correctly

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'inventory_items'
ORDER BY policyname;

-- Check if is_platform_admin() function exists
SELECT
  proname as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'is_platform_admin';
