-- Migration: Enforce audit logs immutability
-- Description: Add explicit DENY policies for UPDATE/DELETE on audit_logs
-- Date: 2026-02-09

-- ============================================================================
-- SECURITY FIX: Audit logs must be truly immutable
-- ============================================================================

-- Problem: No UPDATE/DELETE policies means logs can be modified
-- Solution: Add explicit policies that always return FALSE

-- Deny all UPDATEs (even for platform admins)
DROP POLICY IF EXISTS "audit_logs_deny_update" ON audit_logs;
CREATE POLICY "audit_logs_deny_update" ON audit_logs
  FOR UPDATE TO authenticated
  USING (false); -- Always deny

COMMENT ON POLICY "audit_logs_deny_update" ON audit_logs IS
  'Audit logs are immutable - no updates allowed';

-- Deny all DELETEs (even for platform admins)
DROP POLICY IF EXISTS "audit_logs_deny_delete" ON audit_logs;
CREATE POLICY "audit_logs_deny_delete" ON audit_logs
  FOR DELETE TO authenticated
  USING (false); -- Always deny

COMMENT ON POLICY "audit_logs_deny_delete" ON audit_logs IS
  'Audit logs are immutable - no deletes allowed (service role can still delete for cleanup)';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Migration 025 Complete ===';
  RAISE NOTICE 'Audit logs are now truly immutable:';
  RAISE NOTICE '  - UPDATE operations: DENIED for all authenticated users';
  RAISE NOTICE '  - DELETE operations: DENIED for all authenticated users';
  RAISE NOTICE '  - Service role can still manage logs for cleanup';
  RAISE NOTICE '';
  RAISE NOTICE 'Run tests: npm test -- tests/integration/rls/audit-logs-rls.test.ts';
END $$;
