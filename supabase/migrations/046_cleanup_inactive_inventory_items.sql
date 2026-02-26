-- Migration 046: Clean up soft-deleted inventory items
-- Removes all data associated with inactive (soft-deleted) inventory items,
-- then hard-deletes the items themselves for a clean slate.

-- 1. Remove RESTRICT FK records for inactive items
DELETE FROM recipe_ingredients
WHERE inventory_item_id IN (SELECT id FROM inventory_items WHERE is_active = false);

DELETE FROM store_inventory
WHERE inventory_item_id IN (SELECT id FROM inventory_items WHERE is_active = false);

DELETE FROM stock_history
WHERE inventory_item_id IN (SELECT id FROM inventory_items WHERE is_active = false);

DELETE FROM waste_log
WHERE inventory_item_id IN (SELECT id FROM inventory_items WHERE is_active = false);

DELETE FROM purchase_order_items
WHERE inventory_item_id IN (SELECT id FROM inventory_items WHERE is_active = false);

-- 2. Hard-delete the inactive inventory items
-- CASCADE FKs (inventory_item_tags, supplier_items, pos_item_mappings) auto-clean
DELETE FROM inventory_items WHERE is_active = false;
