-- Migration: Add webhook event deduplication
-- Description: Prevents duplicate processing of Stripe webhook events
--              by adding unique constraint on stripe_event_id

-- ============================================================================
-- 1. Add unique constraint on billing_events.stripe_event_id
-- ============================================================================

-- Remove any duplicate events first (keep the oldest one)
WITH duplicates AS (
  SELECT id, stripe_event_id,
    ROW_NUMBER() OVER (PARTITION BY stripe_event_id ORDER BY created_at ASC) as row_num
  FROM billing_events
  WHERE stripe_event_id IS NOT NULL
)
DELETE FROM billing_events
WHERE id IN (
  SELECT id FROM duplicates WHERE row_num > 1
);

-- Add unique constraint
CREATE UNIQUE INDEX idx_billing_events_stripe_event_id_unique
ON billing_events(stripe_event_id)
WHERE stripe_event_id IS NOT NULL;

COMMENT ON INDEX idx_billing_events_stripe_event_id_unique IS
  'Prevents duplicate processing of Stripe webhook events.
   Stripe may retry webhooks on timeout, so we need to deduplicate by event ID.';

-- ============================================================================
-- 2. Create helper function to check if event already processed
-- ============================================================================

CREATE OR REPLACE FUNCTION is_stripe_event_processed(p_stripe_event_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM billing_events
    WHERE stripe_event_id = p_stripe_event_id
  );
END;
$$;

COMMENT ON FUNCTION is_stripe_event_processed IS
  'Check if a Stripe webhook event has already been processed.
   Used to prevent duplicate event processing in webhook handler.';

-- ============================================================================
-- 3. Verification
-- ============================================================================

DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  -- Check for any remaining duplicates
  SELECT COUNT(*)
  INTO duplicate_count
  FROM (
    SELECT stripe_event_id, COUNT(*) as count
    FROM billing_events
    WHERE stripe_event_id IS NOT NULL
    GROUP BY stripe_event_id
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE NOTICE 'WARNING: Found % duplicate stripe_event_ids after cleanup', duplicate_count;
  ELSE
    RAISE NOTICE 'SUCCESS: No duplicate stripe_event_ids found';
  END IF;

  RAISE NOTICE '=== Migration 017 Complete ===';
  RAISE NOTICE 'Webhook deduplication: ENABLED';
  RAISE NOTICE 'Unique constraint: idx_billing_events_stripe_event_id_unique';
END $$;
