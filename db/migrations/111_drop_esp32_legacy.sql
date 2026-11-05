-- Permanently remove the retired ESP32-S3 prototype and its private schema.
-- The target is fail-closed: both the immutable device UUID and IMEI must match.
-- Teltonika positions, ATS records, status, commands and assignments are untouched.

CREATE TEMP TABLE removed_esp32_target ON COMMIT DROP AS
SELECT id
  FROM gps_devices
 WHERE device_code = 'TPT-1CDBD4475D88'
   AND imei = '861045082880892'
   AND receiver = 'esp32'
   AND manufacturer = 'esp32'
   AND status = 'disabled'
   AND deleted_at IS NOT NULL;

DO $$
DECLARE
  target_count INTEGER;
  identity_collision_count INTEGER;
  active_non_teltonika_count INTEGER;
BEGIN
  SELECT count(*) INTO target_count FROM removed_esp32_target;
  SELECT count(*) INTO identity_collision_count
    FROM gps_devices
   WHERE (
      id = '506702d6-63d9-49be-a3f8-03ba5fcc8311'::uuid
      OR device_code = 'TPT-1CDBD4475D88'
      OR imei = '861045082880892'
   )
     AND id NOT IN (SELECT id FROM removed_esp32_target);
  SELECT count(*) INTO active_non_teltonika_count
    FROM gps_devices
   WHERE deleted_at IS NULL
     AND (receiver <> 'teltonika' OR manufacturer <> 'teltonika');

  IF target_count > 1 OR identity_collision_count <> 0 THEN
    RAISE EXCEPTION 'esp32_target_identity_mismatch';
  END IF;
  IF current_database() = 'tripetica'
     AND (
       target_count <> 1
       OR NOT EXISTS (
         SELECT 1
           FROM removed_esp32_target
          WHERE id = '506702d6-63d9-49be-a3f8-03ba5fcc8311'::uuid
       )
     ) THEN
    RAISE EXCEPTION 'production_esp32_target_not_exact';
  END IF;
  IF active_non_teltonika_count <> 0 THEN
    RAISE EXCEPTION 'active_non_teltonika_devices_exist';
  END IF;
END
$$;

-- ATS child rows cascade from submissions. Remove device-bound audit/control
-- rows explicitly before deleting the device identity.
DELETE FROM gps_ats_submissions
 WHERE device_id IN (SELECT id FROM removed_esp32_target);

DELETE FROM gps_ats_control_events
 WHERE device_id IN (SELECT id FROM removed_esp32_target);

DELETE FROM gps_ats_faults
 WHERE device_id IN (SELECT id FROM removed_esp32_target);

DELETE FROM gps_ats_outages
 WHERE device_id IN (SELECT id FROM removed_esp32_target);

DELETE FROM gps_device_deletion_audits
 WHERE device_id IN (SELECT id FROM removed_esp32_target);

DELETE FROM gps_legacy_esp32_camera_session_audits
 WHERE device_id IN (SELECT id FROM removed_esp32_target);

DELETE FROM gps_legacy_esp32_command_audits
 WHERE device_id IN (SELECT id FROM removed_esp32_target);

DELETE FROM gps_legacy_esp32_retirements
 WHERE device_id IN (SELECT id FROM removed_esp32_target);

-- Cascades remove only this prototype's positions, status, assignments and any
-- remaining private credential/command/session rows.
DELETE FROM gps_devices
 WHERE id IN (SELECT id FROM removed_esp32_target);

DROP TABLE gps_legacy_esp32_camera_session_audits;
DROP TABLE gps_legacy_esp32_command_audits;
DROP TABLE gps_legacy_esp32_retirements;
DROP TABLE gps_low_battery_pushes;
DROP TABLE gps_camera_sessions;
DROP TABLE gps_commands;
DROP TABLE gps_device_credentials;

ALTER TABLE gps_devices
  DROP COLUMN wifi_enabled,
  DROP COLUMN wifi_ssid,
  DROP COLUMN wifi_password_set,
  DROP COLUMN wifi_mode,
  DROP COLUMN wifi_max_clients;

ALTER TABLE gps_device_status
  DROP COLUMN uptime_seconds,
  DROP COLUMN sim_status,
  DROP COLUMN lte_registration,
  DROP COLUMN ppp_status,
  DROP COLUMN napt_status,
  DROP COLUMN ip_address,
  DROP COLUMN gnss_response,
  DROP COLUMN wifi_enabled,
  DROP COLUMN wifi_ssid,
  DROP COLUMN wifi_clients,
  DROP COLUMN wifi_policy,
  DROP COLUMN ap_status,
  DROP COLUMN reported_max_clients,
  DROP COLUMN last_recovery_reason,
  DROP COLUMN last_modem_recovery_at,
  DROP COLUMN last_gnss_recovery_at,
  DROP COLUMN reset_reason,
  DROP COLUMN power_source,
  DROP COLUMN vehicle_battery_voltage,
  DROP COLUMN power_mode,
  DROP COLUMN target_firmware,
  DROP COLUMN firmware_update_status,
  DROP COLUMN camera_available,
  DROP COLUMN camera_ready,
  DROP COLUMN battery_percent,
  DROP COLUMN battery_voltage,
  DROP COLUMN charging_inferred,
  DROP COLUMN battery_measured_at,
  DROP COLUMN low_battery_state,
  DROP COLUMN low_battery_grace_remaining_seconds,
  DROP COLUMN low_battery_episode_at;

ALTER TABLE gps_devices
  DROP CONSTRAINT gps_devices_registration_chk,
  DROP CONSTRAINT gps_devices_manufacturer_chk,
  DROP CONSTRAINT gps_devices_receiver_chk,
  ALTER COLUMN receiver SET DEFAULT 'teltonika',
  ALTER COLUMN manufacturer SET DEFAULT 'teltonika',
  ADD CONSTRAINT gps_devices_receiver_chk
    CHECK (receiver = 'teltonika'),
  ADD CONSTRAINT gps_devices_manufacturer_chk
    CHECK (manufacturer = 'teltonika'),
  ADD CONSTRAINT gps_devices_registration_chk
    CHECK (
      receiver = 'teltonika'
      AND manufacturer = 'teltonika'
      AND imei IS NOT NULL
      AND (
        (tracker_model = 'fmb920' AND link_technology = '2g')
        OR (tracker_model = 'fmc920' AND link_technology = '4g')
      )
    );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM gps_devices
     WHERE id = '506702d6-63d9-49be-a3f8-03ba5fcc8311'::uuid
        OR device_code = 'TPT-1CDBD4475D88'
        OR imei = '861045082880892'
  ) THEN
    RAISE EXCEPTION 'esp32_target_delete_failed';
  END IF;
END
$$;
