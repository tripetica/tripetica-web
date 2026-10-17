-- Partner vehicle service tracking. GPS position tables, ATS, immobilizer,
-- and subscription flags are not modified. The mobile index only speeds up
-- the incremental mileage read.

CREATE TABLE vehicle_maintenance (
  vehicle_id UUID PRIMARY KEY REFERENCES partner_vehicles (id),
  partner_id UUID NOT NULL REFERENCES partners (id),
  cycle_id UUID NOT NULL,
  start_km INTEGER NOT NULL,
  interval_km INTEGER NOT NULL,
  last_service_km INTEGER NOT NULL,
  last_service_on DATE NOT NULL,
  verified_km INTEGER NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL,
  distance_m BIGINT NOT NULL DEFAULT 0,
  cursor_at TIMESTAMPTZ,
  cursor_latitude DOUBLE PRECISION,
  cursor_longitude DOUBLE PRECISION,
  cursor_point_id TEXT,
  distance_source TEXT,
  distance_gap BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vehicle_maintenance_km_chk CHECK (
    start_km >= 0
    AND start_km <= 10000000
    AND interval_km > 0
    AND interval_km <= 10000000
    AND last_service_km >= 0
    AND last_service_km <= 10000000
    AND verified_km >= 0
    AND verified_km <= 10000000
    AND distance_m >= 0
  ),
  CONSTRAINT vehicle_maintenance_source_chk CHECK (
    distance_source IS NULL OR distance_source IN ('physical', 'mobile')
  )
);

CREATE INDEX vehicle_maintenance_partner_idx
  ON vehicle_maintenance (partner_id);

CREATE TABLE vehicle_maintenance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES partner_vehicles (id),
  partner_id UUID NOT NULL REFERENCES partners (id),
  cycle_id UUID NOT NULL,
  kind TEXT NOT NULL,
  odometer_km INTEGER NOT NULL,
  service_on DATE,
  interval_km INTEGER,
  actor_user_id UUID REFERENCES partner_users (id) ON DELETE SET NULL,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vehicle_maintenance_events_kind_chk CHECK (
    kind IN ('setup', 'service', 'correction', 'edit')
  ),
  CONSTRAINT vehicle_maintenance_events_km_chk CHECK (
    odometer_km >= 0 AND odometer_km <= 10000000
  )
);

CREATE UNIQUE INDEX vehicle_maintenance_events_idem_uidx
  ON vehicle_maintenance_events (vehicle_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX vehicle_maintenance_events_vehicle_idx
  ON vehicle_maintenance_events (vehicle_id, created_at DESC);

CREATE TABLE vehicle_maintenance_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES partner_vehicles (id),
  partner_id UUID NOT NULL REFERENCES partners (id),
  cycle_id UUID NOT NULL,
  threshold_km INTEGER NOT NULL,
  title TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT NOT NULL,
  claimed_at TIMESTAMPTZ,
  emailed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vehicle_maintenance_notices_uidx UNIQUE (vehicle_id, cycle_id, threshold_km)
);

CREATE INDEX vehicle_maintenance_notices_partner_idx
  ON vehicle_maintenance_notices (partner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS gps_mobile_positions_vehicle_time_idx
  ON gps_mobile_positions (partner_id, vehicle_id, recorded_at)
  WHERE vehicle_id IS NOT NULL;

REVOKE ALL ON TABLE vehicle_maintenance FROM PUBLIC;
REVOKE ALL ON TABLE vehicle_maintenance_events FROM PUBLIC;
REVOKE ALL ON TABLE vehicle_maintenance_notices FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE vehicle_maintenance TO tripetica_dev_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE vehicle_maintenance_events TO tripetica_dev_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE vehicle_maintenance_notices TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE vehicle_maintenance TO tripetica_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE vehicle_maintenance_events TO tripetica_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE vehicle_maintenance_notices TO tripetica_app;
  END IF;
END
$$;
