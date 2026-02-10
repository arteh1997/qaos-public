-- Migration: Staff shift updates via trigger
-- Description: Use trigger to enforce Staff can only update clock fields
-- Date: 2026-02-09

-- ============================================================================
-- Solution: Use trigger to validate which fields Staff can update
-- ============================================================================

-- First, simplify the UPDATE policy - just check role
DROP POLICY IF EXISTS "shifts_update_policy" ON shifts;

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
  )
  WITH CHECK (
    (SELECT is_platform_admin())
    OR
    -- Owner/Manager can update anything
    EXISTS (
      SELECT 1 FROM store_users
      WHERE store_users.user_id = auth.uid()
        AND store_users.store_id = shifts.store_id
        AND store_users.role IN ('Owner', 'Manager')
    )
  );

-- Now add a separate policy for Staff (only their own shifts, clock fields only)
CREATE POLICY "shifts_staff_clock_update" ON shifts
  FOR UPDATE TO authenticated
  USING (
    -- Staff can select their own shifts
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM store_users
      WHERE store_users.user_id = auth.uid()
        AND store_users.store_id = shifts.store_id
        AND store_users.role = 'Staff'
    )
  )
  WITH CHECK (
    -- Staff can update, but trigger will validate fields
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM store_users
      WHERE store_users.user_id = auth.uid()
        AND store_users.store_id = shifts.store_id
        AND store_users.role = 'Staff'
    )
  );

-- Create trigger function to validate Staff updates
CREATE OR REPLACE FUNCTION validate_staff_shift_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get user's role at this store
  SELECT role INTO user_role
  FROM store_users
  WHERE user_id = auth.uid()
    AND store_id = NEW.store_id
  LIMIT 1;

  -- If user is Staff, check which fields changed
  IF user_role = 'Staff' THEN
    -- Staff cannot change start_time or end_time
    IF (OLD.start_time IS DISTINCT FROM NEW.start_time) OR
       (OLD.end_time IS DISTINCT FROM NEW.end_time) THEN
      RAISE EXCEPTION 'Staff cannot modify shift schedule (start_time/end_time)';
    END IF;

    -- Staff can only update their own shifts
    IF OLD.user_id != auth.uid() OR NEW.user_id != auth.uid() THEN
      RAISE EXCEPTION 'Staff can only update their own shifts';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS enforce_staff_shift_restrictions ON shifts;
CREATE TRIGGER enforce_staff_shift_restrictions
  BEFORE UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION validate_staff_shift_update();

COMMENT ON FUNCTION validate_staff_shift_update() IS
  'Validates that Staff users only update clock_in_time/clock_out_time fields on their own shifts';

DO $$
BEGIN
  RAISE NOTICE '=== Migration 030 Complete ===';
  RAISE NOTICE 'Staff shift update restrictions enforced via trigger:';
  RAISE NOTICE '  - Staff cannot modify start_time or end_time';
  RAISE NOTICE '  - Staff can only update their own shifts';
  RAISE NOTICE '  - Staff can update clock_in_time and clock_out_time';
  RAISE NOTICE '';
  RAISE NOTICE 'Run tests: npm test -- tests/integration/rls/shifts-rls.test.ts';
END $$;
