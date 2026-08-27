-- Single Open Exchange Rates quote cache (EUR-cross rates, 6-hour TTL).
-- Legacy fx_rates / fx_rate_fetch_attempts rows are left in place but unused.

CREATE TABLE IF NOT EXISTS fx_quote_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'open_exchange_rates',
  fetched_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  eur_to_usd NUMERIC(18, 8) NOT NULL,
  eur_to_eur NUMERIC(18, 8) NOT NULL DEFAULT 1,
  eur_to_try NUMERIC(18, 8) NOT NULL,
  market_eur_to_rub NUMERIC(18, 8) NOT NULL,
  eur_to_rub NUMERIC(18, 8) NOT NULL,
  eur_to_gbp NUMERIC(18, 8) NOT NULL,
  raw_rates JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fx_quote_cache_source_chk CHECK (source = 'open_exchange_rates'),
  CONSTRAINT fx_quote_cache_eur_one_chk CHECK (eur_to_eur = 1),
  CONSTRAINT fx_quote_cache_positive_chk CHECK (
    eur_to_usd > 0
    AND eur_to_try > 0
    AND market_eur_to_rub > 0
    AND eur_to_rub > 0
    AND eur_to_gbp > 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS fx_quote_cache_one_active
  ON fx_quote_cache ((TRUE))
  WHERE is_active;

CREATE INDEX IF NOT EXISTS fx_quote_cache_fetched_idx
  ON fx_quote_cache (fetched_at DESC);

REVOKE ALL ON TABLE fx_quote_cache FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE fx_quote_cache TO tripetica_app;
