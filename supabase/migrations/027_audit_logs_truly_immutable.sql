-- Migration: Make audit logs truly immutable
-- Description: Fix UPDATE/DELETE policies with correct syntax
-- Date: 2026-02-09

-- ============================================================================
-- Drop old policies and recreate correctly
-- ============================================================================

-- Remove all existing UPDATE/DELETE policies
DROP POLICY IF EXISTS "audit_logs_deny_update" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_deny_delete" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_update" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete" ON audit_logs;

-- Create restrictive UPDATE policy (deny all)
CREATE POLICY "audit_logs_no_updates" ON audit_logs
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

-- Create restrictive DELETE policy (deny all)
CREATE POLICY "audit_logs_no_deletes" ON audit_logs
  FOR DELETE
  USING (false);

COMMENT ON POLICY "audit_logs_no_updates" ON audit_logs IS
  'Audit logs are immutable - no updates allowed for anyone';

COMMENT ON POLICY "audit_logs_no_deletes" ON audit_logs IS
  'Audit logs are immutable - no deletes allowed for anyone';

-- ============================================================================
-- Verify RLS is enabled
-- ============================================================================

-- Ensure RLS is enabled (should already be, but double-check)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owner (extra safety)
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  RAISE NOTICE '=== Migration 027 Complete ===';
  RAISE NOTICE 'Audit logs are now TRULY immutable:';
  RAISE NOTICE '  - UPDATE: Denied for ALL users (USING false + WITH CHECK false)';
  RAISE NOTICE '  - DELETE: Denied for ALL users (USING false)';
  RAISE NOTICE '  - RLS FORCED even for table owner';
  RAISE NOTICE '';
  RAISE NOTICE 'Service role can still manage via bypass, but authenticated users cannot modify.';
  RAISE NOTICE '';
  RAISE NOTICE 'Run tests: npm test -- tests/integration/rls/audit-logs-rls.test.ts';
END $$;
