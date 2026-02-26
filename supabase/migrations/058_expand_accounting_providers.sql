-- Migration 058: Expand accounting provider CHECK constraint
--
-- Adds 5 new worldwide accounting providers: Sage, MYOB, FreshBooks, Zoho Books, Wave.

ALTER TABLE accounting_connections
  DROP CONSTRAINT IF EXISTS accounting_connections_provider_check;

ALTER TABLE accounting_connections
  ADD CONSTRAINT accounting_connections_provider_check
  CHECK (provider IN (
    -- Original providers
    'xero', 'quickbooks',
    -- New worldwide providers
    'sage',          -- Sage Business Cloud (UK/EU/Africa)
    'myob',          -- MYOB AccountRight Live (AU/NZ)
    'freshbooks',    -- FreshBooks (North America)
    'zoho_books',    -- Zoho Books (India/Middle East/Global)
    'wave'           -- Wave Accounting (North America)
  ));
