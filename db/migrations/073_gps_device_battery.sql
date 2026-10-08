-- Current MAX17048 reading on the device status row. Not copied onto gps_positions.

ALTER TABLE gps_device_status
  ADD COLUMN battery_percent SMALLINT,
  ADD COLUMN battery_voltage NUMERIC,
  ADD COLUMN charging_inferred BOOLEAN,
  ADD COLUMN battery_measured_at TIMESTAMPTZ,
  ADD CONSTRAINT gps_device_status_battery_percent_chk
    CHECK (battery_percent IS NULL OR battery_percent BETWEEN 0 AND 100),
  ADD CONSTRAINT gps_device_status_battery_voltage_chk
    CHECK (battery_voltage IS NULL OR (battery_voltage >= 2 AND battery_voltage <= 5.5));

COMMENT ON COLUMN gps_device_status.battery_percent IS
  'MAX17048 state of charge sent by the device. NULL until a valid battery_percent arrives. Never derived from voltage.';
COMMENT ON COLUMN gps_device_status.battery_voltage IS
  'MAX17048 cell voltage sent by the device. Stored only. Not shown in the partner header.';
COMMENT ON COLUMN gps_device_status.charging_inferred IS
  'Firmware estimate from the state-of-charge trend. Not a measured charge input and not shown in the partner UI.';
COMMENT ON COLUMN gps_device_status.battery_measured_at IS
  'Server time of the last accepted battery_percent. Left unchanged when a later payload omits the field.';
