-- Add operating hours columns to stores table
-- These are stored as TIME strings (HH:MM format) for default hours
-- and JSONB for per-day weekly hours

ALTER TABLE stores
ADD COLUMN IF NOT EXISTS opening_time TIME,
ADD COLUMN IF NOT EXISTS closing_time TIME,
ADD COLUMN IF NOT EXISTS weekly_hours JSONB;

-- Add comment for documentation
COMMENT ON COLUMN stores.opening_time IS 'Default store opening time in HH:MM format (used when weekly_hours not set)';
COMMENT ON COLUMN stores.closing_time IS 'Default store closing time in HH:MM format (used when weekly_hours not set)';
COMMENT ON COLUMN stores.weekly_hours IS 'Per-day operating hours as JSON: { "monday": { "is_open": true, "opening_time": "06:00", "closing_time": "23:00" }, ... }';

-- Create index for queries that filter by stores with hours set
CREATE INDEX IF NOT EXISTS idx_stores_has_hours
ON stores (id)
WHERE opening_time IS NOT NULL AND closing_time IS NOT NULL;

-- Create GIN index for weekly_hours JSONB queries
CREATE INDEX IF NOT EXISTS idx_stores_weekly_hours
ON stores USING GIN (weekly_hours)
WHERE weekly_hours IS NOT NULL;
