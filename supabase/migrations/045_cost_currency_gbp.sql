-- Migration 045: Change currency defaults from USD to GBP
-- The platform serves UK-based restaurants

-- store_inventory
ALTER TABLE store_inventory ALTER COLUMN cost_currency SET DEFAULT 'GBP';
UPDATE store_inventory SET cost_currency = 'GBP' WHERE cost_currency = 'USD';

-- supplier_items
ALTER TABLE supplier_items ALTER COLUMN currency SET DEFAULT 'GBP';
UPDATE supplier_items SET currency = 'GBP' WHERE currency = 'USD';

-- purchase_orders
ALTER TABLE purchase_orders ALTER COLUMN currency SET DEFAULT 'GBP';
UPDATE purchase_orders SET currency = 'GBP' WHERE currency = 'USD';
