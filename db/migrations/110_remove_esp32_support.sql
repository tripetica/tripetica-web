-- Retire the ESP32-S3 prototype and remove its active application schema.
-- GPS positions, ATS submissions/events, assignments and device identity rows
-- remain intact for legal and operational history.

CREATE TEMP TABLE retired_esp32_devices ON COMMIT DROP AS
SELECT id
  FROM gps_devices
 WHERE receiver = 'esp32'
    OR manufacturer = 'esp32'
    OR device_code = 'TPT-1CDBD4475D88'
    OR imei = '861045082880892';

CREATE TEMP TABLE retired_esp32_ats_vehicles ON COMMIT DROP AS
SELECT settings.vehicle_id
  FROM gps_ats_settings settings
 WHERE settings.enabled
   AND settings.source_device_id IN (SELECT id FROM retired_esp32_devices);

CREATE TABLE gps_legacy_esp32_retirements (
  device_id UUID PRIMARY KEY REFERENCES gps_devices (id),
  device_code TEXT NOT NULL,
  imei TEXT,
  partner_id UUID REFERENCES partners (id),
  vehicle_id UUID REFERENCES partner_vehicles (id),
  retired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT NOT NULL DEFAULT 'ESP32-S3 support removed'
);

INSERT INTO gps_legacy_esp32_retirements (
  device_id, device_code, imei, partner_id, vehicle_id
)
SELECT device.id, device.device_code, device.imei, device.partner_id, device.vehicle_id
  FROM gps_devices device
  JOIN retired_esp32_devices retired ON retired.id = device.id
ON CONFLICT (device_id) DO NOTHING;

-- Prefer an installed, active Teltonika already assigned to the same vehicle.
WITH replacements AS (
  SELECT settings.vehicle_id,
         (
           SELECT candidate.id
             FROM gps_devices candidate
            WHERE candidate.vehicle_id = settings.vehicle_id
              AND candidate.receiver = 'teltonika'
              AND candidate.manufacturer = 'teltonika'
              AND candidate.status = 'active'
              AND candidate.installation_status = 'installed'
              AND candidate.live_source = TRUE
              AND candidate.deleted_at IS NULL
              AND candidate.id <> settings.source_device_id
            ORDER BY candidate.updated_at DESC, candidate.id
            LIMIT 1
         ) AS replacement_id
    FROM gps_ats_settings settings
   WHERE settings.enabled
     AND settings.source_device_id IN (SELECT id FROM retired_esp32_devices)
)
UPDATE gps_ats_settings settings
   SET source_device_id = replacement.replacement_id,
       enabled = TRUE,
       updated_at = NOW()
  FROM replacements replacement
 WHERE settings.vehicle_id = replacement.vehicle_id
   AND replacement.replacement_id IS NOT NULL;

UPDATE partner_vehicles vehicle
   SET ats_ministry_source = 'physical'
 WHERE EXISTS (
   SELECT 1
     FROM retired_esp32_ats_vehicles retired
    WHERE retired.vehicle_id = vehicle.id
 )
   AND EXISTS (
   SELECT 1
     FROM gps_ats_settings settings
     JOIN gps_devices device ON device.id = settings.source_device_id
    WHERE settings.vehicle_id = vehicle.id
      AND settings.enabled
      AND device.receiver = 'teltonika'
      AND device.status = 'active'
      AND device.deleted_at IS NULL
 );

-- If no physical replacement exists, use mobile only when an enabled vehicle
-- has a currently active session. Otherwise explicitly stop ministry ATS.
UPDATE partner_vehicles vehicle
   SET ats_ministry_source = CASE
     WHEN vehicle.service_mobile_gps_enabled
      AND EXISTS (
        SELECT 1
          FROM gps_mobile_sessions session
         WHERE session.vehicle_id = vehicle.id
           AND session.status = 'active'
      )
     THEN 'mobile'
     ELSE 'none'
   END
 WHERE EXISTS (
   SELECT 1
     FROM gps_ats_settings settings
    WHERE settings.vehicle_id = vehicle.id
      AND settings.source_device_id IN (SELECT id FROM retired_esp32_devices)
 );

UPDATE gps_ats_settings
   SET enabled = FALSE,
       source_device_id = NULL,
       updated_at = NOW()
 WHERE source_device_id IN (SELECT id FROM retired_esp32_devices);

INSERT INTO gps_device_assignments (device_id, partner_id, vehicle_id, assigned_by)
SELECT device.id, NULL, NULL, 'migration:remove-esp32'
  FROM gps_devices device
  JOIN retired_esp32_devices retired ON retired.id = device.id;

UPDATE gps_devices
   SET status = 'disabled',
       live_source = FALSE,
       partner_id = NULL,
       vehicle_id = NULL,
       deleted_at = COALESCE(deleted_at, NOW()),
       updated_at = NOW()
 WHERE id IN (SELECT id FROM retired_esp32_devices);

-- Preserve non-secret command and camera-session audit metadata, then remove
-- the active queues. Payload/result bodies and credentials are intentionally
-- not archived because they may contain Wi-Fi secrets or device tokens.
CREATE TABLE gps_legacy_esp32_command_audits (
  id UUID PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES gps_devices (id),
  partner_id UUID REFERENCES partners (id),
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  created_by TEXT NOT NULL,
  actor_label TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  delivered_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error TEXT
);

INSERT INTO gps_legacy_esp32_command_audits (
  id, device_id, partner_id, kind, status, created_by, actor_label,
  created_at, delivered_at, finished_at, error
)
SELECT id, device_id, partner_id, kind, status, created_by, actor_label,
       created_at, delivered_at, finished_at, error
  FROM gps_commands;

CREATE TABLE gps_legacy_esp32_camera_session_audits (
  id TEXT PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES gps_devices (id),
  partner_id UUID REFERENCES partners (id),
  surface TEXT NOT NULL,
  opened_by TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_viewer_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ
);

INSERT INTO gps_legacy_esp32_camera_session_audits
SELECT id, device_id, partner_id, surface, opened_by, status,
       created_at, expires_at, last_viewer_at, closed_at
  FROM gps_camera_sessions;

-- Empty and quarantine the legacy active tables. Their physical definitions
-- remain for one rollback window so the previous release can still read its
-- expected schema. A later contract migration may drop them after that release
-- is no longer a rollback candidate.
DELETE FROM gps_low_battery_pushes;
DELETE FROM gps_camera_sessions;
DELETE FROM gps_commands;
DELETE FROM gps_device_credentials;

UPDATE gps_devices
   SET wifi_enabled = FALSE,
       wifi_ssid = NULL,
       wifi_password_set = FALSE,
       wifi_mode = 'off',
       wifi_max_clients = 8
 WHERE id IN (SELECT id FROM retired_esp32_devices);

UPDATE gps_device_status
   SET wifi_enabled = NULL,
       wifi_ssid = NULL,
       wifi_clients = NULL,
       wifi_policy = NULL,
       ap_status = NULL,
       reported_max_clients = NULL,
       camera_available = NULL,
       camera_ready = NULL,
       battery_percent = NULL,
       battery_voltage = NULL,
       charging_inferred = NULL,
       battery_measured_at = NULL,
       low_battery_state = NULL,
       low_battery_grace_remaining_seconds = NULL,
       low_battery_episode_at = NULL,
       power_source = NULL,
       power_mode = NULL
 WHERE device_id IN (SELECT id FROM retired_esp32_devices);

ALTER TABLE gps_devices
  ADD CONSTRAINT gps_devices_active_teltonika_only_chk
  CHECK (
    deleted_at IS NOT NULL
    OR (
      receiver = 'teltonika'
      AND manufacturer = 'teltonika'
      AND tracker_model IN ('fmb920', 'fmc920')
      AND imei IS NOT NULL
    )
  );

COMMENT ON TABLE gps_legacy_esp32_retirements IS
  'Immutable identity/assignment snapshot for devices retired when ESP32-S3 support ended.';
COMMENT ON TABLE gps_legacy_esp32_command_audits IS
  'Sanitized historical ESP32 command audit. No payload, result body, token or Wi-Fi password is retained.';
COMMENT ON TABLE gps_legacy_esp32_camera_session_audits IS
  'Historical ESP32 live-camera access metadata. Frames were never stored.';

REVOKE ALL ON TABLE gps_legacy_esp32_retirements FROM PUBLIC;
REVOKE ALL ON TABLE gps_legacy_esp32_command_audits FROM PUBLIC;
REVOKE ALL ON TABLE gps_legacy_esp32_camera_session_audits FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT ON TABLE gps_legacy_esp32_retirements TO tripetica_dev_app;
    GRANT SELECT ON TABLE gps_legacy_esp32_command_audits TO tripetica_dev_app;
    GRANT SELECT ON TABLE gps_legacy_esp32_camera_session_audits TO tripetica_dev_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE gps_device_credentials FROM tripetica_dev_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE gps_commands FROM tripetica_dev_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE gps_camera_sessions FROM tripetica_dev_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE gps_low_battery_pushes FROM tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT ON TABLE gps_legacy_esp32_retirements TO tripetica_app;
    GRANT SELECT ON TABLE gps_legacy_esp32_command_audits TO tripetica_app;
    GRANT SELECT ON TABLE gps_legacy_esp32_camera_session_audits TO tripetica_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE gps_device_credentials FROM tripetica_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE gps_commands FROM tripetica_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE gps_camera_sessions FROM tripetica_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE gps_low_battery_pushes FROM tripetica_app;
  END IF;
END
$$;
