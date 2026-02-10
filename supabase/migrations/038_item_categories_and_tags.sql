-- Migration 038: Item Categories and Tags
-- Adds proper category and tag management with many-to-many relationships

-- ============================================================================
-- 1. Create item_categories table
-- ============================================================================

CREATE TABLE item_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT, -- Hex color for UI (e.g., '#3B82F6')
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, name)
);

CREATE INDEX idx_item_categories_store_id ON item_categories(store_id);
CREATE INDEX idx_item_categories_sort_order ON item_categories(store_id, sort_order);

COMMENT ON TABLE item_categories IS 'Product categories for inventory organization (Produce, Dairy, Meat, etc.)';
COMMENT ON COLUMN item_categories.color IS 'Hex color code for UI display';
COMMENT ON COLUMN item_categories.sort_order IS 'Display order in UI (lower numbers first)';

-- ============================================================================
-- 2. Create item_tags table
-- ============================================================================

CREATE TABLE item_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT, -- Hex color for UI badges
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, name)
);

CREATE INDEX idx_item_tags_store_id ON item_tags(store_id);

COMMENT ON TABLE item_tags IS 'Tags for inventory items (Perishable, High-Value, Seasonal, etc.)';
COMMENT ON COLUMN item_tags.color IS 'Hex color code for badge display';

-- ============================================================================
-- 3. Create many-to-many relationship table for item tags
-- ============================================================================

CREATE TABLE inventory_item_tags (
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES item_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (inventory_item_id, tag_id)
);

CREATE INDEX idx_inventory_item_tags_item_id ON inventory_item_tags(inventory_item_id);
CREATE INDEX idx_inventory_item_tags_tag_id ON inventory_item_tags(tag_id);

COMMENT ON TABLE inventory_item_tags IS 'Many-to-many relationship between inventory items and tags';

-- ============================================================================
-- 4. Add category_id to inventory_items
-- ============================================================================

-- Add the new foreign key column
ALTER TABLE inventory_items
  ADD COLUMN category_id UUID REFERENCES item_categories(id) ON DELETE SET NULL;

CREATE INDEX idx_inventory_items_category_id ON inventory_items(category_id);

COMMENT ON COLUMN inventory_items.category_id IS 'Foreign key to item_categories (replaces old category text field)';

-- ============================================================================
-- 5. Migrate existing category strings to categories table
-- ============================================================================

-- Insert unique categories from existing inventory_items (grouped by store)
WITH unique_categories AS (
  SELECT DISTINCT
    ii.category,
    si.store_id
  FROM inventory_items ii
  INNER JOIN store_inventory si ON si.inventory_item_id = ii.id
  WHERE ii.category IS NOT NULL
    AND ii.category != ''
)
INSERT INTO item_categories (store_id, name, sort_order)
SELECT
  store_id,
  category,
  ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY category) - 1 AS sort_order
FROM unique_categories
ON CONFLICT (store_id, name) DO NOTHING;

-- Update inventory_items to reference the new categories
UPDATE inventory_items ii
SET category_id = (
  SELECT ic.id
  FROM item_categories ic
  INNER JOIN store_inventory si ON si.store_id = ic.store_id
  WHERE si.inventory_item_id = ii.id
    AND ic.name = ii.category
  LIMIT 1
)
WHERE ii.category IS NOT NULL AND ii.category != '';

-- Note: We keep the old 'category' column for now as a backup
-- Can be dropped in a future migration after verifying data migration

-- ============================================================================
-- 6. RLS Policies for item_categories
-- ============================================================================

ALTER TABLE item_categories ENABLE ROW LEVEL SECURITY;

-- Users can view categories for stores they have access to
CREATE POLICY "Users can view categories for accessible stores"
  ON item_categories
  FOR SELECT
  USING (
    store_id IN (
      SELECT store_id
      FROM store_users
      WHERE user_id = auth.uid()
    )
  );

-- Owners and Managers can create categories
CREATE POLICY "Owners and Managers can create categories"
  ON item_categories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM store_users
      WHERE store_id = item_categories.store_id
        AND user_id = auth.uid()
        AND role IN ('Owner', 'Manager')
    )
  );

-- Owners and Managers can update categories
CREATE POLICY "Owners and Managers can update categories"
  ON item_categories
  FOR UPDATE
  USING (
    EXISTS (lœer5678
      SELECT 1 FROM store_users
      WHERE store_id = item_categories.store_id
        AND user_id = auth.uid()
        AND role IN ('Owner', 'Manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM store_users
      WHERE store_id = item_categories.store_id
        AND user_id = auth.uid()
        AND role IN ('Owner', 'Manager')
    )
  );

-- Owners can delete categories
CREATE POLICY "Owners can delete categories"
  ON item_categories
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM store_users
      WHERE store_id = item_categories.store_id
        AND user_id = auth.uid()
        AND role = 'Owner'
    )
  );

-- ============================================================================
-- 7. RLS Policies for item_tags
-- ============================================================================

ALTER TABLE item_tags ENABLE ROW LEVEL SECURITY;

-- Users can view tags for stores they have access to
CREATE POLICY "Users can view tags for accessible stores"
  ON item_tags
  FOR SELECT
  USING (
    store_id IN (
      SELECT store_id
      FROM store_users
      WHERE user_id = auth.uid()
    )
  );

-- Owners and Managers can create tags
CREATE POLICY "Owners and Managers can create tags"
  ON item_tags
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM store_users
      WHERE store_id = item_tags.store_id
        AND user_id = auth.uid()
        AND role IN ('Owner', 'Manager')
    )
  );

-- Owners and Managers can update tags
CREATE POLICY "Owners and Managers can update tags"
  ON item_tags
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM store_users
      WHERE store_id = item_tags.store_id
        AND user_id = auth.uid()
        AND role IN ('Owner', 'Manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM store_users
      WHERE store_id = item_tags.store_id
        AND user_id = auth.uid()
        AND role IN ('Owner', 'Manager')
    )
  );

-- Owners can delete tags
CREATE POLICY "Owners can delete tags"
  ON item_tags
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM store_users
      WHERE store_id = item_tags.store_id
        AND user_id = auth.uid()
        AND role = 'Owner'
    )
  );

-- ============================================================================
-- 8. RLS Policies for inventory_item_tags
-- ============================================================================

ALTER TABLE inventory_item_tags ENABLE ROW LEVEL SECURITY;

-- Users can view tags for items they have access to
CREATE POLICY "Users can view item tags for accessible stores"
  ON inventory_item_tags
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM inventory_items ii
      INNER JOIN store_inventory si ON si.inventory_item_id = ii.id
      INNER JOIN store_users su ON su.store_id = si.store_id
      WHERE ii.id = inventory_item_tags.inventory_item_id
        AND su.user_id = auth.uid()
    )
  );

-- Owners and Managers can add tags to items
CREATE POLICY "Owners and Managers can add tags to items"
  ON inventory_item_tags
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM inventory_items ii
      INNER JOIN store_inventory si ON si.inventory_item_id = ii.id
      INNER JOIN store_users su ON su.store_id = si.store_id
      WHERE ii.id = inventory_item_tags.inventory_item_id
        AND su.user_id = auth.uid()
        AND su.role IN ('Owner', 'Manager')
    )
  );

-- Owners and Managers can remove tags from items
CREATE POLICY "Owners and Managers can remove tags from items"
  ON inventory_item_tags
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM inventory_items ii
      INNER JOIN store_inventory si ON si.inventory_item_id = ii.id
      INNER JOIN store_users su ON su.store_id = si.store_id
      WHERE ii.id = inventory_item_tags.inventory_item_id
        AND su.user_id = auth.uid()
        AND su.role IN ('Owner', 'Manager')
    )
  );

-- ============================================================================
-- 9. Create some default categories for new stores
-- ============================================================================

-- Function to create default categories when a new store is created
CREATE OR REPLACE FUNCTION create_default_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO item_categories (store_id, name, color, sort_order) VALUES
    (NEW.id, 'Produce', '#22C55E', 1),
    (NEW.id, 'Dairy', '#3B82F6', 2),
    (NEW.id, 'Meat & Seafood', '#EF4444', 3),
    (NEW.id, 'Dry Goods', '#F59E0B', 4),
    (NEW.id, 'Beverages', '#8B5CF6', 5),
    (NEW.id, 'Frozen', '#06B6D4', 6),
    (NEW.id, 'Other', '#6B7280', 7)
  ON CONFLICT (store_id, name) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger to create default categories for new stores
CREATE TRIGGER create_default_categories_trigger
  AFTER INSERT ON stores
  FOR EACH ROW
  EXECUTE FUNCTION create_default_categories();

COMMENT ON FUNCTION create_default_categories() IS 'Creates default categories when a new store is created';

-- ============================================================================
-- 10. Helper function to get items by category
-- ============================================================================

CREATE OR REPLACE FUNCTION get_items_by_category(p_store_id UUID)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  category_color TEXT,
  item_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    ic.id AS category_id,
    ic.name AS category_name,
    ic.color AS category_color,
    COUNT(ii.id) AS item_count
  FROM item_categories ic
  LEFT JOIN inventory_items ii ON ii.category_id = ic.id AND ii.is_active = true
  WHERE ic.store_id = p_store_id
  GROUP BY ic.id, ic.name, ic.color, ic.sort_order
  ORDER BY ic.sort_order, ic.name;
$$;

COMMENT ON FUNCTION get_items_by_category(UUID) IS 'Get category summary with item counts for a store';
