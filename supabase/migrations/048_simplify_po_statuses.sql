-- Migration 048: Simplify purchase order statuses
--
-- Reduces 7 statuses (draft/submitted/acknowledged/shipped/partial/received/cancelled)
-- to 5 restaurant-friendly statuses (open/awaiting_delivery/partial/received/cancelled).

-- Step 1: Drop old constraint FIRST (so we can update to new values)
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

-- Step 2: Migrate existing data to new statuses
UPDATE purchase_orders SET status = 'open' WHERE status IN ('draft', 'submitted', 'acknowledged');
UPDATE purchase_orders SET status = 'awaiting_delivery' WHERE status = 'shipped';

-- Step 3: Add new constraint
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check
  CHECK (status IN ('open', 'awaiting_delivery', 'partial', 'received', 'cancelled'));

-- Step 4: Update default
ALTER TABLE purchase_orders ALTER COLUMN status SET DEFAULT 'open';
