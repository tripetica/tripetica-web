ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS service_content_snapshot JSONB;
