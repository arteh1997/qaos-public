-- Migration 056: Add country and currency to stores for multi-currency billing
--
-- Stores can now be associated with a country (ISO 3166-1 alpha-2) and
-- currency (ISO 4217). This enables region-appropriate pricing.

-- Add country and currency columns to stores
ALTER TABLE stores ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'GB';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'GBP';

-- Add introductory pricing tracking to subscriptions
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_introductory BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS original_amount INTEGER;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'gbp';

-- Index for querying stores by country
CREATE INDEX IF NOT EXISTS idx_stores_country ON stores(country);

-- Comment for documentation
COMMENT ON COLUMN stores.country IS 'ISO 3166-1 alpha-2 country code (e.g., GB, US, SA)';
COMMENT ON COLUMN stores.currency IS 'ISO 4217 currency code (e.g., GBP, USD, SAR) — derived from country';
COMMENT ON COLUMN subscriptions.is_introductory IS 'Whether this subscription has grandfathered introductory pricing';
COMMENT ON COLUMN subscriptions.original_amount IS 'The original price amount in smallest currency unit at time of subscription creation';
COMMENT ON COLUMN subscriptions.currency IS 'The currency of this subscription (matches store currency at creation time)';
