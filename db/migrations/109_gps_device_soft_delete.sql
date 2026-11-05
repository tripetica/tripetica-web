-- Keep legal GPS/ATS/U-ETDS history while removing a device from active inventory.
-- Deleted devices cannot authenticate; their former assignment is snapshotted for audit.

ALTER TABLE gps_devices
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN deleted_by UUID;

DROP INDEX gps_devices_imei_uidx;
CREATE UNIQUE INDEX gps_devices_imei_uidx
  ON gps_devices (imei)
  WHERE imei IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX gps_devices_deleted_idx
  ON gps_devices (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE TABLE gps_device_deletion_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES gps_devices (id),
  device_code TEXT NOT NULL,
  imei TEXT,
  sim_phone TEXT,
  manufacturer TEXT NOT NULL,
  tracker_model TEXT,
  partner_id UUID REFERENCES partners (id),
  vehicle_id UUID REFERENCES partner_vehicles (id),
  actor_id UUID NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX gps_device_deletion_audits_device_uidx
  ON gps_device_deletion_audits (device_id);

COMMENT ON COLUMN gps_devices.deleted_at IS
  'Logical deletion timestamp. The row remains so GPS, ATS, U-ETDS, and legal history retain identity.';
COMMENT ON COLUMN gps_devices.deleted_by IS
  'Ops actor who logically deleted the device. Kept without a foreign key so the audit survives actor removal.';
COMMENT ON TABLE gps_device_deletion_audits IS
  'Immutable server-side snapshot of device ownership and identity at logical deletion.';

REVOKE ALL ON TABLE gps_device_deletion_audits FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, DELETE ON TABLE gps_device_deletion_audits TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT ON TABLE gps_device_deletion_audits TO tripetica_app;
  END IF;
END
$$;
