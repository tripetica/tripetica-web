ALTER TABLE reservation_searches
  ADD COLUMN IF NOT EXISTS selected_tour_code TEXT;

UPDATE reservation_searches
SET selected_tour_code = tour_code
WHERE selected_tour_code IS NULL
  AND tour_code IS NOT NULL;
