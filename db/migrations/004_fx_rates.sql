-- FX rates (EUR base) and applied multi-currency snapshot.
-- History is retained; only is_active marks the current row per source.

CREATE TABLE IF NOT EXISTS fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency CHAR(3) NOT NULL DEFAULT 'EUR',
  quote_currency CHAR(3) NOT NULL,
  rate NUMERIC(18, 8) NOT NULL,
  source TEXT NOT NULL,
  rate_type TEXT NOT NULL,
  valid_date DATE,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_manual BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'ok',
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fx_rates_base_eur_chk CHECK (base_currency = 'EUR'),
  CONSTRAINT fx_rates_quote_chk CHECK (quote_currency IN ('USD', 'EUR', 'TRY', 'RUB', 'GBP')),
  CONSTRAINT fx_rates_source_chk CHECK (source IN ('ECB', 'SBERBANK', 'MANUAL')),
  CONSTRAINT fx_rates_rate_type_chk CHECK (rate_type IN ('reference', 'bank_sell')),
  CONSTRAINT fx_rates_status_chk CHECK (status IN ('ok', 'error')),
  CONSTRAINT fx_rates_rate_positive_chk CHECK (rate > 0),
  CONSTRAINT fx_rates_manual_rub_chk CHECK (
    (NOT is_manual) OR (quote_currency = 'RUB' AND source = 'MANUAL' AND rate_type = 'bank_sell')
  )
);

DROP TRIGGER IF EXISTS fx_rates_set_updated_at ON fx_rates;
CREATE TRIGGER fx_rates_set_updated_at
  BEFORE UPDATE ON fx_rates
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS fx_rates_active_quote_fetched_idx
  ON fx_rates (quote_currency, fetched_at DESC)
  WHERE is_active AND status = 'ok';

CREATE UNIQUE INDEX IF NOT EXISTS fx_rates_one_active_manual_rub
  ON fx_rates (quote_currency)
  WHERE is_active AND is_manual AND quote_currency = 'RUB';

CREATE TABLE IF NOT EXISTS fx_rate_fetch_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  quote_currency CHAR(3),
  status TEXT NOT NULL,
  error_code TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fx_rate_fetch_attempts_status_chk CHECK (status IN ('ok', 'error'))
);

CREATE INDEX IF NOT EXISTS fx_rate_fetch_attempts_fetched_idx
  ON fx_rate_fetch_attempts (fetched_at DESC);

ALTER TABLE reservation_searches
  ADD COLUMN IF NOT EXISTS applied_fx_snapshot JSONB;

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS fx_snapshot JSONB;

COMMENT ON COLUMN reservation_searches.applied_fx_snapshot IS
  'EUR vehicle total and converted totals captured from active FX rates when the applied transfer quote is stored. Frozen until the next Apply. Copy onto reservations.fx_snapshot when a vehicle/checkout is confirmed.';

COMMENT ON COLUMN reservations.fx_snapshot IS
  'Frozen FX conversion used for the confirmed reservation. Prepared for copy from reservation_searches.applied_fx_snapshot.';

REVOKE ALL ON TABLE fx_rates, fx_rate_fetch_attempts FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE fx_rates, fx_rate_fetch_attempts TO tripetica_app;
