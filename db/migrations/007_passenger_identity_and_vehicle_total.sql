-- Optional passenger identity (passport / national ID) and frozen selected-vehicle totals.
-- applied_price stays the route base EUR fee; do not reuse it for vehicle totals.

ALTER TABLE reservation_searches_passengers
  ADD COLUMN IF NOT EXISTS identity_number TEXT;

ALTER TABLE reservations_passengers
  ADD COLUMN IF NOT EXISTS identity_number TEXT;

ALTER TABLE reservation_searches
  ADD COLUMN IF NOT EXISTS applied_vehicle_total_eur NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS applied_vehicle_total NUMERIC(12, 2);

ALTER TABLE reservation_searches
  DROP CONSTRAINT IF EXISTS reservation_searches_applied_vehicle_total_eur_chk;
ALTER TABLE reservation_searches
  ADD CONSTRAINT reservation_searches_applied_vehicle_total_eur_chk
    CHECK (applied_vehicle_total_eur IS NULL OR applied_vehicle_total_eur >= 0);

ALTER TABLE reservation_searches
  DROP CONSTRAINT IF EXISTS reservation_searches_applied_vehicle_total_chk;
ALTER TABLE reservation_searches
  ADD CONSTRAINT reservation_searches_applied_vehicle_total_chk
    CHECK (applied_vehicle_total IS NULL OR applied_vehicle_total >= 0);

COMMENT ON COLUMN reservation_searches_passengers.identity_number IS
  'Optional passport, TC kimlik or other travel identity. Null when not provided.';
COMMENT ON COLUMN reservations_passengers.identity_number IS
  'Optional passport, TC kimlik or other travel identity. Null when not provided.';
COMMENT ON COLUMN reservation_searches.applied_vehicle_total_eur IS
  'Frozen selected-vehicle EUR total shown at selection time. Distinct from applied_price (route base fee).';
COMMENT ON COLUMN reservation_searches.applied_vehicle_total IS
  'Frozen selected-vehicle total in reservation_searches.currency, captured at selection or currency change using applied_fx_snapshot.';
