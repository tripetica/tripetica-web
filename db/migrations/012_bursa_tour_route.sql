-- Bursa tour route preference (ferry vs bridge/highway).

ALTER TABLE reservation_searches
  ADD COLUMN IF NOT EXISTS selected_bursa_route TEXT,
  ADD COLUMN IF NOT EXISTS applied_bursa_route TEXT;

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS bursa_route TEXT;

COMMENT ON COLUMN reservation_searches.selected_bursa_route IS
  'Bursa tour route preference before apply: ferry (default) or bridge.';
COMMENT ON COLUMN reservation_searches.applied_bursa_route IS
  'Applied Bursa tour route preference used for pricing.';
COMMENT ON COLUMN reservations.bursa_route IS
  'Confirmed Bursa tour route: ferry or bridge.';
