-- One Wi-Fi apply command. Reboot stays the existing kind.
-- Client limit matches the current device radio: 1 to 8.

ALTER TABLE gps_commands DROP CONSTRAINT gps_commands_kind_chk;
ALTER TABLE gps_commands
  ADD CONSTRAINT gps_commands_kind_chk CHECK (kind IN (
    'wifi.configure',
    'wifi.disable',
    'reboot',
    'modem_reset',
    'gnss_restart',
    'ppp_reconnect',
    'wifi_on',
    'wifi_off',
    'wifi_auto',
    'set_ssid',
    'set_password',
    'set_telemetry',
    'status',
    'set_max_wifi_clients',
    'wifi_config'
  ));

ALTER TABLE gps_devices DROP CONSTRAINT gps_devices_wifi_max_clients_chk;
ALTER TABLE gps_devices
  ADD CONSTRAINT gps_devices_wifi_max_clients_chk
    CHECK (wifi_max_clients BETWEEN 1 AND 8);

COMMENT ON COLUMN gps_devices.wifi_max_clients IS
  'Desired passenger Wi-Fi client limit, 1 to 8. Applied only after the device acks wifi_config.';
