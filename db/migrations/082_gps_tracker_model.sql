-- Teltonika model on a device. ESP32 rows stay unlabeled.
-- FMB920 and FMC920 share the GPS panel; the model selects command support.

ALTER TABLE gps_devices
  ADD COLUMN tracker_model TEXT;

ALTER TABLE gps_devices
  ADD CONSTRAINT gps_devices_tracker_model_chk
  CHECK (tracker_model IS NULL OR tracker_model IN ('fmb920', 'fmc920'));

ALTER TABLE gps_devices
  ADD CONSTRAINT gps_devices_tracker_receiver_chk
  CHECK (
    (receiver = 'teltonika' AND tracker_model IS NOT NULL)
    OR (receiver <> 'teltonika' AND tracker_model IS NULL)
  );

COMMENT ON COLUMN gps_devices.tracker_model IS
  'fmb920 is 2G. fmc920 is 4G LTE with 2G fallback. Null on ESP32 devices.';
