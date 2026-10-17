-- A stock device is configured, online, and not yet assigned.
-- Its GNSS fixes are stored without a partner or vehicle.
-- A later assignment does not rewrite those rows.
-- ATS still requires a vehicle, so stock fixes are not ministry notices.

ALTER TABLE gps_positions
  ALTER COLUMN partner_id DROP NOT NULL,
  ALTER COLUMN vehicle_id DROP NOT NULL;

ALTER TABLE gps_positions
  ADD CONSTRAINT gps_positions_assignment_pair_chk
  CHECK (vehicle_id IS NULL OR partner_id IS NOT NULL);

COMMENT ON TABLE gps_positions IS
  'GNSS history. partner_id and vehicle_id are copied at ingest. Both stay empty while the device is in stock. A later assignment does not rewrite the route.';
