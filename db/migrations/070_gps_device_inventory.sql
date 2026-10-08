-- Ops inventory: a device can sit in stock before a partner and vehicle are assigned.
-- Position rows keep the partner and vehicle copied at ingest, so a later assignment
-- does not rewrite history. This migration does not start firmware updates.

ALTER TABLE gps_devices
  ALTER COLUMN partner_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION gps_devices_enforce_vehicle_partner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.partner_id IS NULL AND NEW.vehicle_id IS NOT NULL THEN
    RAISE EXCEPTION 'gps_device_vehicle_partner_mismatch'
      USING ERRCODE = '23514';
  END IF;
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

ALTER TABLE gps_device_credentials
  ADD COLUMN revoked_at TIMESTAMPTZ;

COMMENT ON COLUMN gps_device_credentials.revoked_at IS
  'Set when ops revokes the device token. The hash stays; authentication rejects the row.';

ALTER TABLE gps_device_status
  ADD COLUMN target_firmware TEXT,
  ADD COLUMN firmware_update_status TEXT,
  ADD CONSTRAINT gps_device_status_firmware_update_chk
    CHECK (
      firmware_update_status IS NULL
      OR firmware_update_status IN (
        'idle', 'offered', 'downloading', 'applying', 'succeeded', 'failed', 'rolled_back'
      )
    );

COMMENT ON COLUMN gps_device_status.firmware IS
  'Current firmware reported by the device heartbeat. Null until the device reports it.';
COMMENT ON COLUMN gps_device_status.target_firmware IS
  'Reserved for a future OTA offer. Nothing writes this column yet.';
COMMENT ON COLUMN gps_device_status.firmware_update_status IS
  'Reserved for a future OTA state. Nothing writes this column yet.';

CREATE TABLE gps_device_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES gps_devices (id) ON DELETE CASCADE,
  partner_id UUID REFERENCES partners (id),
  vehicle_id UUID REFERENCES partner_vehicles (id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by TEXT NOT NULL,
  CONSTRAINT gps_device_assignments_actor_chk CHECK (char_length(assigned_by) BETWEEN 1 AND 80)
);

CREATE INDEX gps_device_assignments_device_idx
  ON gps_device_assignments (device_id, assigned_at DESC);

COMMENT ON TABLE gps_device_assignments IS
  'Assignment log. gps_positions keep their own partner_id and vehicle_id from ingest.';

INSERT INTO gps_device_assignments (device_id, partner_id, vehicle_id, assigned_at, assigned_by)
SELECT device.id, device.partner_id, device.vehicle_id, device.created_at, 'migration'
FROM gps_devices device;

REVOKE ALL ON TABLE gps_device_assignments FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gps_device_assignments TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gps_device_assignments TO tripetica_app;
  END IF;
END
$$;
