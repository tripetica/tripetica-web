-- Manual operational price overrides and change audit for ops record editing.

ALTER TABLE reservation_searches
  ADD COLUMN IF NOT EXISTS price_manually_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS manual_price_totals JSONB;

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS price_manually_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS manual_price_totals JSONB,
  ADD COLUMN IF NOT EXISTS system_total_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS system_currency CHAR(3),
  ADD COLUMN IF NOT EXISTS system_fx_snapshot JSONB;

COMMENT ON COLUMN reservation_searches.manual_price_totals IS
  'Per-currency manual operational totals (USD/EUR/TRY/RUB/GBP) when price_manually_overridden is true.';
COMMENT ON COLUMN reservations.manual_price_totals IS
  'Per-currency manual operational totals when price_manually_overridden is true.';
COMMENT ON COLUMN reservations.system_total_price IS
  'System-calculated total at reservation creation before any manual override.';
COMMENT ON COLUMN reservations.system_fx_snapshot IS
  'FX snapshot at reservation creation before any manual override.';

CREATE TABLE IF NOT EXISTS ops_record_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_kind TEXT NOT NULL CHECK (record_kind IN ('process', 'reservation')),
  record_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID NOT NULL REFERENCES ops_users (id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ops_record_audits_record_idx
  ON ops_record_audits (record_kind, record_id, changed_at DESC);
