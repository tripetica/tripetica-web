-- Vehicle GPS devices inside the existing Tripetica database.
-- Partner, vehicle, and U-ETDS company rows stay the source of identity.
-- This schema does not send positions to the ministry.

CREATE TABLE gps_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners (id),
  vehicle_id UUID REFERENCES partner_vehicles (id),
  label TEXT NOT NULL,
  imei TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  wifi_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  wifi_ssid TEXT,
  wifi_password_set BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gps_devices_label_chk CHECK (char_length(label) BETWEEN 1 AND 80),
  CONSTRAINT gps_devices_imei_chk CHECK (imei IS NULL OR imei ~ '^[0-9]{14,16}$'),
  CONSTRAINT gps_devices_status_chk CHECK (status IN ('active', 'disabled')),
  CONSTRAINT gps_devices_ssid_chk CHECK (wifi_ssid IS NULL OR char_length(wifi_ssid) BETWEEN 1 AND 32)
);

CREATE UNIQUE INDEX gps_devices_imei_uidx
  ON gps_devices (imei)
  WHERE imei IS NOT NULL;

CREATE INDEX gps_devices_partner_idx ON gps_devices (partner_id);
CREATE INDEX gps_devices_vehicle_idx ON gps_devices (vehicle_id);

CREATE TRIGGER gps_devices_set_updated_at
  BEFORE UPDATE ON gps_devices
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION gps_devices_enforce_vehicle_partner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.vehicle_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM partner_vehicles vehicle
    WHERE vehicle.id = NEW.vehicle_id
      AND vehicle.partner_id = NEW.partner_id
      AND vehicle.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'gps_device_vehicle_partner_mismatch'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER gps_devices_vehicle_partner
  BEFORE INSERT OR UPDATE OF partner_id, vehicle_id ON gps_devices
  FOR EACH ROW
  EXECUTE FUNCTION gps_devices_enforce_vehicle_partner();

CREATE TABLE gps_device_credentials (
  device_id UUID PRIMARY KEY REFERENCES gps_devices (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_at TIMESTAMPTZ,
  CONSTRAINT gps_device_credentials_hash_chk
    CHECK (token_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE gps_device_status (
  device_id UUID PRIMARY KEY REFERENCES gps_devices (id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  last_contiguous_seq BIGINT NOT NULL DEFAULT 0,
  firmware TEXT,
  rssi INTEGER,
  network TEXT,
  operator_name TEXT,
  wifi_enabled BOOLEAN,
  wifi_ssid TEXT,
  wifi_clients INTEGER,
  gnss_fix BOOLEAN,
  latitude NUMERIC,
  longitude NUMERIC,
  speed_mps NUMERIC,
  heading_deg NUMERIC,
  altitude_m NUMERIC,
  satellites INTEGER,
  hdop NUMERIC,
  pdop NUMERIC,
  vdop NUMERIC,
  fix_mode TEXT,
  recorded_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gps_device_status_seq_chk CHECK (last_contiguous_seq >= 0)
);

CREATE TABLE gps_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES gps_devices (id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners (id),
  vehicle_id UUID NOT NULL REFERENCES partner_vehicles (id),
  seq BIGINT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  altitude_m NUMERIC,
  speed_mps NUMERIC,
  heading_deg NUMERIC,
  satellites INTEGER,
  hdop NUMERIC,
  pdop NUMERIC,
  vdop NUMERIC,
  fix_mode TEXT,
  CONSTRAINT gps_positions_seq_chk CHECK (seq > 0),
  CONSTRAINT gps_positions_lat_chk CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT gps_positions_lon_chk CHECK (longitude >= -180 AND longitude <= 180),
  UNIQUE (device_id, seq)
);

CREATE INDEX gps_positions_device_time_idx
  ON gps_positions (device_id, recorded_at);

CREATE INDEX gps_positions_vehicle_time_idx
  ON gps_positions (partner_id, vehicle_id, recorded_at);

CREATE TABLE gps_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES gps_devices (id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners (id),
  kind TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  result JSONB,
  error TEXT,
  CONSTRAINT gps_commands_kind_chk CHECK (kind IN ('wifi.configure', 'wifi.disable')),
  CONSTRAINT gps_commands_status_chk
    CHECK (status IN ('queued', 'delivered', 'acked', 'failed', 'cancelled')),
  CONSTRAINT gps_commands_created_by_chk CHECK (created_by IN ('ops', 'partner')),
  CONSTRAINT gps_commands_payload_chk CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX gps_commands_device_open_idx
  ON gps_commands (device_id, created_at)
  WHERE status IN ('queued', 'delivered');

COMMENT ON TABLE gps_positions IS
  'GNSS history. partner_id and vehicle_id are copied at ingest so a later device move does not rewrite the route.';
COMMENT ON TABLE gps_commands IS
  'Device command queue. Wi-Fi passphrases are removed from payload after ack, failure, or cancel.';

REVOKE ALL ON TABLE gps_devices FROM PUBLIC;
REVOKE ALL ON TABLE gps_device_credentials FROM PUBLIC;
REVOKE ALL ON TABLE gps_device_status FROM PUBLIC;
REVOKE ALL ON TABLE gps_positions FROM PUBLIC;
REVOKE ALL ON TABLE gps_commands FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gps_devices TO tripetica_dev_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gps_device_credentials TO tripetica_dev_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gps_device_status TO tripetica_dev_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gps_positions TO tripetica_dev_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gps_commands TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gps_devices TO tripetica_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gps_device_credentials TO tripetica_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gps_device_status TO tripetica_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gps_positions TO tripetica_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gps_commands TO tripetica_app;
  END IF;
END
$$;
