-- Teltonika AVL ID 253 (green driving type) and 254 (green driving value).
-- These rows are separate from gps_positions. Position ingest, ATS, U-ETDS,
-- and the immobilizer are unchanged.
-- Type: 1 acceleration, 2 braking, 3 cornering.
-- AVL 254 for a GNSS source: acceleration and braking are g×100,
-- cornering is rad/s×100. The raw integer is stored unchanged.

CREATE TABLE gps_green_driving_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES gps_devices (id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners (id),
  vehicle_id UUID NOT NULL REFERENCES partner_vehicles (id),
  recorded_at TIMESTAMPTZ NOT NULL,
  kind TEXT NOT NULL,
  raw_value INTEGER,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gps_green_driving_kind_chk CHECK (kind IN ('acceleration', 'braking', 'cornering')),
  CONSTRAINT gps_green_driving_value_chk CHECK (raw_value IS NULL OR raw_value BETWEEN 0 AND 65535),
  CONSTRAINT gps_green_driving_lat_chk CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT gps_green_driving_lon_chk CHECK (longitude >= -180 AND longitude <= 180)
);

CREATE UNIQUE INDEX gps_green_driving_event_uidx
  ON gps_green_driving_events (device_id, recorded_at, kind);

CREATE INDEX gps_green_driving_vehicle_time_idx
  ON gps_green_driving_events (partner_id, vehicle_id, recorded_at);

COMMENT ON TABLE gps_green_driving_events IS
  'FMB920 AVL 253/254 events. Empty means none arrived. Not a substitute for gps_positions.';

ALTER TABLE gps_device_status
  ADD COLUMN green_driving_parser_at TIMESTAMPTZ;

COMMENT ON COLUMN gps_device_status.green_driving_parser_at IS
  'Set when a listener build that stores AVL 253/254 accepts a packet. NULL means that build has not run for this device.';

REVOKE ALL ON TABLE gps_green_driving_events FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT ON TABLE gps_green_driving_events TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT ON TABLE gps_green_driving_events TO tripetica_app;
  END IF;
END
$$;
