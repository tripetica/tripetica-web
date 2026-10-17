-- Explicit Teltonika DIN1 (AVL ID 1) on a physical fix, plus the last
-- ignition carried by the estimated-mileage cursor. NULL means the record
-- did not include DIN1. Unknown ignition is not treated as off.
-- IO 239, ATS, U-ETDS, and the immobilizer are unchanged.

ALTER TABLE gps_positions
  ADD COLUMN ignition TEXT;

ALTER TABLE gps_positions
  ADD CONSTRAINT gps_positions_ignition_chk
  CHECK (ignition IS NULL OR ignition IN ('on', 'off'));

COMMENT ON COLUMN gps_positions.ignition IS
  'Explicit Teltonika AVL ID 1 (DIN1) for this fix. NULL means not reported. Not IO 239.';

ALTER TABLE vehicle_maintenance
  ADD COLUMN cursor_ignition TEXT;

ALTER TABLE vehicle_maintenance
  ADD CONSTRAINT vehicle_maintenance_cursor_ignition_chk
  CHECK (cursor_ignition IS NULL OR cursor_ignition IN ('on', 'off'));

COMMENT ON COLUMN vehicle_maintenance.cursor_ignition IS
  'Last explicit DIN1 carried by the estimated-km cursor. NULL means unknown.';
