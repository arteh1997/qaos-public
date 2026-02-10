-- Migration 042: Suppliers & Purchase Orders
-- Adds supplier management, supplier-specific pricing, and purchase order workflow

-- ============================================================
-- 0. CREATE update_updated_at_column() IF NOT EXISTS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. SUPPLIERS TABLE (store-scoped)
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  contact_person TEXT,
  payment_terms TEXT,  -- e.g., "Net 30", "COD", "Net 15"
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, name)
);

CREATE INDEX idx_suppliers_store_id ON suppliers(store_id);
CREATE INDEX idx_suppliers_active ON suppliers(store_id, is_active);

-- ============================================================
-- 2. SUPPLIER_ITEMS TABLE (supplier-specific pricing per item)
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  supplier_sku TEXT,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  lead_time_days INTEGER,
  min_order_quantity NUMERIC DEFAULT 1,
  is_preferred BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(supplier_id, inventory_item_id)
);

CREATE INDEX idx_supplier_items_supplier_id ON supplier_items(supplier_id);
CREATE INDEX idx_supplier_items_inventory_item_id ON supplier_items(inventory_item_id);

-- ============================================================
-- 3. PURCHASE_ORDERS TABLE (store-scoped)
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  po_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'acknowledged', 'shipped', 'partial', 'received', 'cancelled')),
  order_date DATE,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, po_number)
);

CREATE INDEX idx_purchase_orders_store_id ON purchase_orders(store_id);
CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(store_id, status);
CREATE INDEX idx_purchase_orders_order_date ON purchase_orders(store_id, order_date DESC);

-- ============================================================
-- 4. PURCHASE_ORDER_ITEMS TABLE (line items)
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  supplier_item_id UUID REFERENCES supplier_items(id),
  quantity_ordered NUMERIC NOT NULL,
  quantity_received NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(purchase_order_id, inventory_item_id)
);

CREATE INDEX idx_po_items_purchase_order_id ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_po_items_inventory_item_id ON purchase_order_items(inventory_item_id);

-- ============================================================
-- 5. UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_supplier_items_updated_at
  BEFORE UPDATE ON supplier_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Suppliers: Users can see/manage suppliers for their stores
CREATE POLICY "suppliers_select" ON suppliers
  FOR SELECT USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "suppliers_insert" ON suppliers
  FOR INSERT WITH CHECK (store_id = ANY(get_user_store_ids()));

CREATE POLICY "suppliers_update" ON suppliers
  FOR UPDATE USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "suppliers_delete" ON suppliers
  FOR DELETE USING (store_id = ANY(get_user_store_ids()));

-- Supplier Items: Access via supplier -> store chain
CREATE POLICY "supplier_items_select" ON supplier_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = supplier_items.supplier_id
      AND s.store_id = ANY(get_user_store_ids())
    )
  );

CREATE POLICY "supplier_items_insert" ON supplier_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = supplier_items.supplier_id
      AND s.store_id = ANY(get_user_store_ids())
    )
  );

CREATE POLICY "supplier_items_update" ON supplier_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = supplier_items.supplier_id
      AND s.store_id = ANY(get_user_store_ids())
    )
  );

CREATE POLICY "supplier_items_delete" ON supplier_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = supplier_items.supplier_id
      AND s.store_id = ANY(get_user_store_ids())
    )
  );

-- Purchase Orders: Store-scoped
CREATE POLICY "purchase_orders_select" ON purchase_orders
  FOR SELECT USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "purchase_orders_insert" ON purchase_orders
  FOR INSERT WITH CHECK (store_id = ANY(get_user_store_ids()));

CREATE POLICY "purchase_orders_update" ON purchase_orders
  FOR UPDATE USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "purchase_orders_delete" ON purchase_orders
  FOR DELETE USING (store_id = ANY(get_user_store_ids()));

-- Purchase Order Items: Access via PO -> store chain
CREATE POLICY "po_items_select" ON purchase_order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_items.purchase_order_id
      AND po.store_id = ANY(get_user_store_ids())
    )
  );

CREATE POLICY "po_items_insert" ON purchase_order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_items.purchase_order_id
      AND po.store_id = ANY(get_user_store_ids())
    )
  );

CREATE POLICY "po_items_update" ON purchase_order_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_items.purchase_order_id
      AND po.store_id = ANY(get_user_store_ids())
    )
  );

CREATE POLICY "po_items_delete" ON purchase_order_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_items.purchase_order_id
      AND po.store_id = ANY(get_user_store_ids())
    )
  );
