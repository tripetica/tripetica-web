-- Bosphorus dinner cruise per-person participant counts.

ALTER TABLE reservation_searches
  ADD COLUMN IF NOT EXISTS selected_bosphorus_adult_soft INTEGER,
  ADD COLUMN IF NOT EXISTS selected_bosphorus_adult_alcohol INTEGER,
  ADD COLUMN IF NOT EXISTS selected_bosphorus_child_5_9 INTEGER,
  ADD COLUMN IF NOT EXISTS selected_bosphorus_child_0_4 INTEGER,
  ADD COLUMN IF NOT EXISTS applied_bosphorus_adult_soft INTEGER,
  ADD COLUMN IF NOT EXISTS applied_bosphorus_adult_alcohol INTEGER,
  ADD COLUMN IF NOT EXISTS applied_bosphorus_child_5_9 INTEGER,
  ADD COLUMN IF NOT EXISTS applied_bosphorus_child_0_4 INTEGER;

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS bosphorus_adult_soft INTEGER,
  ADD COLUMN IF NOT EXISTS bosphorus_adult_alcohol INTEGER,
  ADD COLUMN IF NOT EXISTS bosphorus_child_5_9 INTEGER,
  ADD COLUMN IF NOT EXISTS bosphorus_child_0_4 INTEGER;

COMMENT ON COLUMN reservation_searches.selected_bosphorus_adult_soft IS
  'Bosphorus dinner: adult soft-drink (10+) count before apply.';
COMMENT ON COLUMN reservation_searches.selected_bosphorus_adult_alcohol IS
  'Bosphorus dinner: adult alcoholic (18+) count before apply.';
COMMENT ON COLUMN reservation_searches.selected_bosphorus_child_5_9 IS
  'Bosphorus dinner: child ages 5-9 count before apply.';
COMMENT ON COLUMN reservation_searches.selected_bosphorus_child_0_4 IS
  'Bosphorus dinner: child ages 0-4 count before apply.';
COMMENT ON COLUMN reservations.bosphorus_adult_soft IS
  'Confirmed Bosphorus dinner adult soft-drink (10+) count.';
COMMENT ON COLUMN reservations.bosphorus_adult_alcohol IS
  'Confirmed Bosphorus dinner adult alcoholic (18+) count.';
COMMENT ON COLUMN reservations.bosphorus_child_5_9 IS
  'Confirmed Bosphorus dinner child ages 5-9 count.';
COMMENT ON COLUMN reservations.bosphorus_child_0_4 IS
  'Confirmed Bosphorus dinner child ages 0-4 count.';
