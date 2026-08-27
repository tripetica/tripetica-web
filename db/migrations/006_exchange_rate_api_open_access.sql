-- Switch the FX quote cache to ExchangeRate-API Open Access (EUR base, 24h TTL).
-- Rows from the retired Open Exchange Rates source are removed.

ALTER TABLE fx_quote_cache
  DROP CONSTRAINT IF EXISTS fx_quote_cache_source_chk;

ALTER TABLE fx_quote_cache
  ALTER COLUMN source SET DEFAULT 'exchange-rate-api-open-access';

DELETE FROM fx_quote_cache
WHERE source <> 'exchange-rate-api-open-access';

ALTER TABLE fx_quote_cache
  ADD CONSTRAINT fx_quote_cache_source_chk
  CHECK (source = 'exchange-rate-api-open-access');
