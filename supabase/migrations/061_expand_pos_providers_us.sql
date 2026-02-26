-- Migration 061: Expand POS provider CHECK constraint for US market
-- Adds 20 new North American POS providers

ALTER TABLE pos_connections
  DROP CONSTRAINT IF EXISTS pos_connections_provider_check;

ALTER TABLE pos_connections
  ADD CONSTRAINT pos_connections_provider_check
  CHECK (provider IN (
    -- Original providers
    'square', 'toast', 'clover', 'lightspeed',
    'zettle', 'sumup', 'epos_now', 'tevalis',
    -- Worldwide providers (migration 057)
    'foodics', 'oracle_micros', 'ncr_voyix', 'spoton', 'revel',
    'touchbistro', 'gastrofix', 'iiko', 'posrocket',
    -- US market providers (migration 061)
    'par_brink', 'heartland', 'hungerrush', 'cake',
    'lavu', 'focus_pos', 'shopify_pos', 'aldelo_express',
    'squirrel', 'gotab', 'xenial', 'qu_pos',
    'future_pos', 'upserve', 'sicom', 'positouch',
    'harbortouch', 'digital_dining', 'maitred', 'speedline',
    -- Custom webhook
    'custom'
  ));
