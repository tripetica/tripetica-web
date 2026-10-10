-- Teltonika registration profile. Existing ESP32 and already-registered
-- trackers stay installed and remain the live map source. New Teltonika rows
-- are inserted as installation pending and are not a second live source.
-- SIM access credentials are not columns on this table.

ALTER TABLE gps_devices
  ADD COLUMN manufacturer TEXT,
  ADD COLUMN link_technology TEXT,
  ADD COLUMN serial_number TEXT,
  ADD COLUMN sim_phone TEXT,
  ADD COLUMN sim_operator TEXT,
  ADD COLUMN sim_apn TEXT,
  ADD COLUMN installation_status TEXT,
  ADD COLUMN live_source BOOLEAN;

UPDATE gps_devices
SET manufacturer = CASE WHEN receiver = 'teltonika' THEN 'teltonika' ELSE 'esp32' END,
    link_technology = CASE tracker_model
      WHEN 'fmb920' THEN '2g'
      WHEN 'fmc920' THEN '4g'
      ELSE NULL
    END,
    installation_status = 'installed',
    live_source = TRUE
WHERE manufacturer IS NULL;

ALTER TABLE gps_devices
  ALTER COLUMN manufacturer SET NOT NULL,
  ALTER COLUMN installation_status SET NOT NULL,
  ALTER COLUMN live_source SET NOT NULL,
  ALTER COLUMN manufacturer SET DEFAULT 'esp32',
  ALTER COLUMN installation_status SET DEFAULT 'installed',
  ALTER COLUMN live_source SET DEFAULT TRUE;

ALTER TABLE gps_devices
  ADD CONSTRAINT gps_devices_manufacturer_chk
  CHECK (manufacturer IN ('esp32', 'teltonika'));

ALTER TABLE gps_devices
  ADD CONSTRAINT gps_devices_link_chk
  CHECK (link_technology IS NULL OR link_technology IN ('2g', '4g'));

ALTER TABLE gps_devices
  ADD CONSTRAINT gps_devices_installation_chk
  CHECK (installation_status IN ('pending', 'installed'));

ALTER TABLE gps_devices
  ADD CONSTRAINT gps_devices_serial_chk
  CHECK (serial_number IS NULL OR serial_number ~ '^[A-Za-z0-9-]{1,40}$');

ALTER TABLE gps_devices
  ADD CONSTRAINT gps_devices_sim_phone_chk
  CHECK (sim_phone IS NULL OR sim_phone ~ '^\+?[0-9]{8,15}$');

ALTER TABLE gps_devices
  ADD CONSTRAINT gps_devices_sim_operator_chk
  CHECK (sim_operator IS NULL OR char_length(sim_operator) BETWEEN 1 AND 40);

ALTER TABLE gps_devices
  ADD CONSTRAINT gps_devices_sim_apn_chk
  CHECK (sim_apn IS NULL OR sim_apn ~ '^[A-Za-z0-9._-]{1,64}$');

ALTER TABLE gps_devices
  ADD CONSTRAINT gps_devices_registration_chk
  CHECK (
    (
      receiver = 'esp32'
      AND manufacturer = 'esp32'
      AND tracker_model IS NULL
      AND link_technology IS NULL
    )
    OR (
      receiver = 'teltonika'
      AND manufacturer = 'teltonika'
      AND imei IS NOT NULL
      AND tracker_model = 'fmb920'
      AND link_technology = '2g'
    )
    OR (
      receiver = 'teltonika'
      AND manufacturer = 'teltonika'
      AND imei IS NOT NULL
      AND tracker_model = 'fmc920'
      AND link_technology = '4g'
    )
  );

CREATE UNIQUE INDEX gps_devices_one_live_source_idx
  ON gps_devices (vehicle_id)
  WHERE live_source AND status = 'active' AND vehicle_id IS NOT NULL;

COMMENT ON COLUMN gps_devices.installation_status IS
  'pending until the first valid Teltonika fix. Separate from online or offline presence.';

COMMENT ON COLUMN gps_devices.live_source IS
  'At most one active device is the live map source for a vehicle. This does not select the ATS source.';
