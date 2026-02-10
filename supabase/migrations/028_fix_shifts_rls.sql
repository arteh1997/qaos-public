-- Migration: Fix shifts RLS policies
-- Description: Correct Staff permissions for viewing and updating shifts
-- Date: 2026-02-09

-- ============================================================================
-- Fix: Staff should see ALL shifts at their store, not just their own
-- Fix: Staff cannot update schedules, but CAN clock in/out
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "shifts_select_policy" ON shifts;
DROP POLICY IF EXISTS "shifts_update_policy" ON shifts;

-- SELECT: All store members can see ALL shifts at their stores
CREATE POLICY "shifts_select_policy" ON shifts
  FOR SELECT TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR
    -- Users can see shifts at stores they have access to
    EXISTS (
      SELECT 1 FROM store_users
      WHERE store_users.user_id = auth.uid()
        AND store_users.store_id = shifts.store_id
    )
  );

-- UPDATE: Complex policy for different update types
-- Owner/Manager can update anything
-- Staff can ONLY update their own clock_in_time/clock_out_time
CREATE POLICY "shifts_update_policy" ON shifts
  FOR UPDATE TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR
    -- Owner/Manager can update any shift at their store
    EXISTS (
      SELECT 1 FROM store_users
      WHERE store_users.user_id = auth.uid()
        AND store_users.store_id = shifts.store_id
        AND store_users.role IN ('Owner', 'Manager')
    )
    OR
    -- Staff can update ONLY their own shifts (for clock in/out)
    (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM store_users
        WHERE store_users.user_id = auth.uid()
          AND store_users.store_id = shifts.store_id
          AND store_users.role = 'Staff'
      )
    )
  )
  WITH CHECK (
    (SELECT is_platform_admin())
    OR
    -- Owner/Manager can change anything
    EXISTS (
      SELECT 1 FROM store_users
      WHERE store_users.user_id = auth.uid()
        AND store_users.store_id = shifts.store_id
        AND store_users.role IN ('Owner', 'Manager')
    )
    OR
    -- Staff can only update clock times, not schedule times
    -- This is enforced at application layer (API checks which fields changed)
    (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM store_users
        WHERE store_users.user_id = auth.uid()
          AND store_users.store_id = shifts.store_id
          AND store_users.role = 'Staff'
      )
    )
  );

COMMENT ON POLICY "shifts_select_policy" ON shifts IS
  'All store members can view shifts at their stores';

COMMENT ON POLICY "shifts_update_policy" ON shifts IS
  'Owner/Manager can update any shift. Staff can only update their own shifts (clock in/out). Application layer enforces field-level restrictions.';

-- ============================================================================
-- Note on Staff UPDATE permissions
-- ============================================================================

-- RLS allows Staff to UPDATE their own shifts, but the application layer
-- must enforce that Staff can ONLY update clock_in_time/clock_out_time fields.
--
-- This is handled in:
-- - app/api/shifts/[shiftId]/route.ts (validates which fields Staff can modify)
-- - app/api/shifts/clock/route.ts (clock in/out endpoint)

DO $$
BEGIN
  RAISE NOTICE '=== Migration 028 Complete ===';
  RAISE NOTICE 'Shifts RLS policies fixed:';
  RAISE NOTICE '  - SELECT: All store members see ALL shifts at their store';
  RAISE NOTICE '  - UPDATE: Owner/Manager can update anything';
  RAISE NOTICE '  - UPDATE: Staff can update their own shifts (app enforces clock-only)';
  RAISE NOTICE '';
  RAISE NOTICE 'Run tests: npm test -- tests/integration/rls/shifts-rls.test.ts';
END $$;
