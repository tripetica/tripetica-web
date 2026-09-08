-- Persist ExchangeRate-API time_next_update_utc from the last successful fetch.
ALTER TABLE fx_quote_cache
  ADD COLUMN IF NOT EXISTS provider_next_update_at TIMESTAMPTZ;
