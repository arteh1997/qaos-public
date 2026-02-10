-- Migration: 041_recipe_costing.sql
-- Description: Recipe Costing & Menu Analysis infrastructure
-- - Add unit_cost to store_inventory for ingredient costing
-- - Create recipes table (store-scoped)
-- - Create recipe_ingredients table (links recipes to inventory items)
-- - Create menu_items table (links recipes to selling prices)
-- - RLS policies for all new tables

-- 1. Add unit_cost field to store_inventory
ALTER TABLE store_inventory
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_currency TEXT DEFAULT 'USD';

-- 2. Create recipes table
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  yield_quantity NUMERIC NOT NULL DEFAULT 1 CHECK (yield_quantity > 0),
  yield_unit TEXT NOT NULL DEFAULT 'serving',
  prep_time_minutes INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, name)
);

CREATE INDEX IF NOT EXISTS idx_recipes_store_id ON recipes(store_id);
CREATE INDEX IF NOT EXISTS idx_recipes_active ON recipes(store_id, is_active);

-- 3. Create recipe_ingredients table
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit_of_measure TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(recipe_id, inventory_item_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_item ON recipe_ingredients(inventory_item_id);

-- 4. Create menu_items table
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  selling_price NUMERIC NOT NULL CHECK (selling_price >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, name)
);

CREATE INDEX IF NOT EXISTS idx_menu_items_store ON menu_items(store_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_recipe ON menu_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_active ON menu_items(store_id, is_active);

-- 5. Enable RLS
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for recipes
CREATE POLICY "recipes_select" ON recipes
  FOR SELECT USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "recipes_insert" ON recipes
  FOR INSERT WITH CHECK (store_id = ANY(get_user_store_ids()));

CREATE POLICY "recipes_update" ON recipes
  FOR UPDATE USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "recipes_delete" ON recipes
  FOR DELETE USING (store_id = ANY(get_user_store_ids()));

-- 7. RLS Policies for recipe_ingredients
-- Access is through the recipe's store_id
CREATE POLICY "recipe_ingredients_select" ON recipe_ingredients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM recipes r
      WHERE r.id = recipe_ingredients.recipe_id
      AND r.store_id = ANY(get_user_store_ids())
    )
  );

CREATE POLICY "recipe_ingredients_insert" ON recipe_ingredients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes r
      WHERE r.id = recipe_ingredients.recipe_id
      AND r.store_id = ANY(get_user_store_ids())
    )
  );

CREATE POLICY "recipe_ingredients_update" ON recipe_ingredients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM recipes r
      WHERE r.id = recipe_ingredients.recipe_id
      AND r.store_id = ANY(get_user_store_ids())
    )
  );

CREATE POLICY "recipe_ingredients_delete" ON recipe_ingredients
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM recipes r
      WHERE r.id = recipe_ingredients.recipe_id
      AND r.store_id = ANY(get_user_store_ids())
    )
  );

-- 8. RLS Policies for menu_items
CREATE POLICY "menu_items_select" ON menu_items
  FOR SELECT USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "menu_items_insert" ON menu_items
  FOR INSERT WITH CHECK (store_id = ANY(get_user_store_ids()));

CREATE POLICY "menu_items_update" ON menu_items
  FOR UPDATE USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "menu_items_delete" ON menu_items
  FOR DELETE USING (store_id = ANY(get_user_store_ids()));

-- 9. Updated_at trigger for recipes
CREATE OR REPLACE FUNCTION update_recipes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW
  EXECUTE FUNCTION update_recipes_updated_at();

-- 10. Updated_at trigger for menu_items
CREATE OR REPLACE FUNCTION update_menu_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_menu_items_updated_at
  BEFORE UPDATE ON menu_items
  FOR EACH ROW
  EXECUTE FUNCTION update_menu_items_updated_at();
