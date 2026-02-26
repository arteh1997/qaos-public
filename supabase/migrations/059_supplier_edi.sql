-- Migration 059: Add EDI webhook configuration to suppliers
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS edi_webhook_url TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS edi_webhook_secret TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS edi_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN suppliers.edi_webhook_url IS 'Webhook URL for electronic PO delivery';
COMMENT ON COLUMN suppliers.edi_webhook_secret IS 'HMAC-SHA256 secret for signing EDI payloads';
COMMENT ON COLUMN suppliers.edi_enabled IS 'Whether to automatically send POs via EDI when submitted';
