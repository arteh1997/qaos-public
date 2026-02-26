-- Migration 053: Invoice OCR / Scanning
-- Adds invoices and invoice_line_items tables for uploading supplier invoices,
-- extracting data via OCR (Google Document AI), and applying to inventory.

-- ============================================================
-- Invoices table
-- ============================================================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,

  -- File storage (Supabase Storage)
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size_bytes INTEGER,

  -- Invoice metadata (from OCR or manual entry)
  invoice_number TEXT,
  invoice_date DATE,
  due_date DATE,
  subtotal NUMERIC(12,2),
  tax_amount NUMERIC(12,2),
  total_amount NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'GBP',

  -- OCR results
  extracted_data JSONB DEFAULT '{}',
  ocr_provider TEXT,
  ocr_confidence NUMERIC(5,2),
  ocr_raw_response JSONB,
  ocr_processed_at TIMESTAMPTZ,

  -- Workflow
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'review', 'approved', 'applied', 'rejected')),

  applied_reception_id UUID,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,

  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Invoice line items (extracted from OCR, editable before applying)
-- ============================================================
CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

  -- OCR extracted fields
  description TEXT,
  quantity NUMERIC(12,4),
  unit_price NUMERIC(12,4),
  total_price NUMERIC(12,2),
  unit_of_measure TEXT,

  -- Matching to inventory
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  match_confidence NUMERIC(5,2),
  match_status TEXT NOT NULL DEFAULT 'unmatched'
    CHECK (match_status IN ('unmatched', 'auto_matched', 'manually_matched', 'skipped')),

  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_invoices_store_id ON invoices(store_id);
CREATE INDEX idx_invoices_supplier_id ON invoices(supplier_id);
CREATE INDEX idx_invoices_purchase_order_id ON invoices(purchase_order_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_created_at ON invoices(created_at DESC);
CREATE INDEX idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
CREATE INDEX idx_invoice_line_items_inventory_item ON invoice_line_items(inventory_item_id);

-- ============================================================
-- Row-Level Security
-- ============================================================
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Invoices: store-scoped access
CREATE POLICY "invoices_select" ON invoices
  FOR SELECT USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "invoices_insert" ON invoices
  FOR INSERT WITH CHECK (store_id = ANY(get_user_store_ids()));

CREATE POLICY "invoices_update" ON invoices
  FOR UPDATE USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "invoices_delete" ON invoices
  FOR DELETE USING (store_id = ANY(get_user_store_ids()));

-- Invoice line items: access through parent invoice
CREATE POLICY "invoice_line_items_select" ON invoice_line_items
  FOR SELECT USING (
    invoice_id IN (SELECT id FROM invoices WHERE store_id = ANY(get_user_store_ids()))
  );

CREATE POLICY "invoice_line_items_insert" ON invoice_line_items
  FOR INSERT WITH CHECK (
    invoice_id IN (SELECT id FROM invoices WHERE store_id = ANY(get_user_store_ids()))
  );

CREATE POLICY "invoice_line_items_update" ON invoice_line_items
  FOR UPDATE USING (
    invoice_id IN (SELECT id FROM invoices WHERE store_id = ANY(get_user_store_ids()))
  );

CREATE POLICY "invoice_line_items_delete" ON invoice_line_items
  FOR DELETE USING (
    invoice_id IN (SELECT id FROM invoices WHERE store_id = ANY(get_user_store_ids()))
  );

-- ============================================================
-- Triggers
-- ============================================================
CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_invoice_line_items_updated_at
  BEFORE UPDATE ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
