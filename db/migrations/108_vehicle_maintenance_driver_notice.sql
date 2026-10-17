-- Driver copy for an existing maintenance notice.
-- The partner title and body stay on the same row.

ALTER TABLE vehicle_maintenance_notices
  ADD COLUMN driver_id UUID REFERENCES partner_drivers (id) ON DELETE SET NULL,
  ADD COLUMN driver_title TEXT,
  ADD COLUMN driver_body_text TEXT,
  ADD COLUMN driver_email_subject TEXT,
  ADD COLUMN driver_email_text TEXT,
  ADD COLUMN driver_email_html TEXT;

COMMENT ON COLUMN vehicle_maintenance_notices.driver_title IS
  'Portal and push title for the assigned driver. Null when the vehicle has no driver.';
