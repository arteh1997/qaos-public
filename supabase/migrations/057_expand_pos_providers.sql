-- Migration 057: Expand POS provider CHECK constraint
--
-- Fixes the original CHECK in migration 044 which only had 5 providers,
-- and adds 9 new worldwide POS providers.

-- Drop the old constraint and add the expanded one
ALTER TABLE pos_connections
  DROP CONSTRAINT IF EXISTS pos_connections_provider_check;

ALTER TABLE pos_connections
  ADD CONSTRAINT pos_connections_provider_check
  CHECK (provider IN (
    -- Original providers
    'square', 'toast', 'clover', 'lightspeed',
    -- Added in code (were missing from migration)
    'zettle', 'sumup', 'epos_now', 'tevalis',
    -- New worldwide providers
    'foodics',          -- Middle East (Saudi/Gulf) — OAuth2
    'oracle_micros',    -- Global enterprise — API Key
    'ncr_voyix',        -- North America (Aloha) — API Key
    'spoton',           -- North America — OAuth2
    'revel',            -- North America/Global — OAuth2
    'touchbistro',      -- North America — API Key
    'gastrofix',        -- Germany/Europe — API Key
    'iiko',             -- Russia/Middle East/CIS — API Key
    'posrocket',        -- Middle East — API Key
    -- Custom webhook
    'custom'
  ));
