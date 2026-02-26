-- Migration 051: Add setup_completed_at to stores
-- Tracks when a store has completed the setup wizard.
-- NULL means setup is incomplete; a timestamp means it's done.

ALTER TABLE stores ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ DEFAULT NULL;

-- Backfill: only mark stores as setup-complete if they actually have inventory.
-- Stores without inventory should go through the setup wizard.
UPDATE stores s
SET setup_completed_at = NOW()
WHERE setup_completed_at IS NULL
  AND EXISTS (
    SELECT 1 FROM store_inventory si WHERE si.store_id = s.id
  );

-- Fix: un-stamp stores that were incorrectly backfilled without inventory.
UPDATE stores s
SET setup_completed_at = NULL
WHERE setup_completed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM store_inventory si WHERE si.store_id = s.id
  );
