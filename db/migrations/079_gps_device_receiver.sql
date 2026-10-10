-- Distinguishes the HTTPS ESP32 receiver from the Teltonika TCP receiver.
-- Existing rows stay esp32. Positions, ATS settings, and ministry sends are unchanged.

ALTER TABLE gps_devices
  ADD COLUMN receiver TEXT NOT NULL DEFAULT 'esp32';

ALTER TABLE gps_devices
  ADD CONSTRAINT gps_devices_receiver_chk
  CHECK (receiver IN ('esp32', 'teltonika'));

COMMENT ON COLUMN gps_devices.receiver IS
  'esp32 keeps the HTTPS device API. teltonika is accepted only by the separate TCP AVL listener. ATS still follows gps_ats_settings.source_device_id.';
