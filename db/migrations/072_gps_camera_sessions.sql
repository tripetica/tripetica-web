-- Live camera sessions only. JPEG frames are not stored in PostgreSQL.

ALTER TABLE gps_device_status
  ADD COLUMN camera_available BOOLEAN,
  ADD COLUMN camera_ready BOOLEAN;

COMMENT ON COLUMN gps_device_status.camera_available IS
  'Reported by the device heartbeat. NULL until the device sends camera_available.';
COMMENT ON COLUMN gps_device_status.camera_ready IS
  'Reported by the device heartbeat. NULL until the device sends camera_ready.';

CREATE TABLE gps_camera_sessions (
  id TEXT PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES gps_devices (id) ON DELETE CASCADE,
  partner_id UUID REFERENCES partners (id),
  surface TEXT NOT NULL,
  opened_by TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_viewer_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  CONSTRAINT gps_camera_sessions_id_chk CHECK (id ~ '^[A-Za-z0-9_-]{43}$'),
  CONSTRAINT gps_camera_sessions_surface_chk CHECK (surface IN ('partner', 'ops')),
  CONSTRAINT gps_camera_sessions_status_chk CHECK (status IN ('open', 'closed', 'expired')),
  CONSTRAINT gps_camera_sessions_opened_by_chk CHECK (char_length(opened_by) BETWEEN 1 AND 80)
);

CREATE INDEX gps_camera_sessions_device_open_idx
  ON gps_camera_sessions (device_id, created_at DESC)
  WHERE status = 'open';

COMMENT ON TABLE gps_camera_sessions IS
  'Short-lived live view grants. Frames stay in process memory and are not recorded.';

REVOKE ALL ON TABLE gps_camera_sessions FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gps_camera_sessions TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gps_camera_sessions TO tripetica_app;
  END IF;
END
$$;
