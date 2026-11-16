-- Additive storage keeps legacy listeners and existing events unchanged.
CREATE TABLE gps_green_driving_event_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES gps_devices(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES partners(id),
  vehicle_id uuid NOT NULL REFERENCES partner_vehicles(id),
  recorded_at timestamptz NOT NULL,
  kind text NOT NULL CHECK (kind IN ('acceleration', 'braking', 'cornering')),
  raw_value integer CHECK (raw_value BETWEEN 0 AND 65535),
  latitude numeric NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude numeric NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX gps_green_driving_variant_uidx ON gps_green_driving_event_variants
  (device_id, recorded_at, kind, (COALESCE(raw_value, -1)), latitude, longitude);
CREATE INDEX gps_green_driving_variant_vehicle_time_idx ON gps_green_driving_event_variants (vehicle_id, recorded_at);
REVOKE ALL ON gps_green_driving_event_variants FROM PUBLIC;
DO $$
DECLARE app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['tripetica_app', 'tripetica_dev_app'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('GRANT SELECT, INSERT ON gps_green_driving_event_variants TO %I', app_role);
    END IF;
  END LOOP;
END $$;
