-- Additive GPS controls. Existing device API tables stay in place.
-- Command kinds grow to the firmware names. Legacy wifi.configure and wifi.disable remain valid.

ALTER TABLE gps_devices
  ADD COLUMN device_code TEXT,
  ADD COLUMN wifi_mode TEXT NOT NULL DEFAULT 'off',
  ADD COLUMN wifi_max_clients INTEGER NOT NULL DEFAULT 8;

UPDATE gps_devices
SET device_code = 'TPT-' || upper(substr(replace(id::text, '-', ''), 1, 12))
WHERE device_code IS NULL;

UPDATE gps_devices
SET wifi_mode = 'on'
WHERE wifi_enabled = TRUE
  AND wifi_mode = 'off';

ALTER TABLE gps_devices
  ALTER COLUMN device_code SET NOT NULL;

ALTER TABLE gps_devices
  ADD CONSTRAINT gps_devices_device_code_chk
    CHECK (device_code ~ '^TPT-[0-9A-F]{12}$'),
  ADD CONSTRAINT gps_devices_wifi_mode_chk
    CHECK (wifi_mode IN ('on', 'off', 'auto')),
  ADD CONSTRAINT gps_devices_wifi_max_clients_chk
    CHECK (wifi_max_clients BETWEEN 1 AND 16);

CREATE UNIQUE INDEX gps_devices_device_code_uidx ON gps_devices (device_code);

ALTER TABLE gps_device_status
  ADD COLUMN uptime_seconds INTEGER,
  ADD COLUMN sim_status TEXT,
  ADD COLUMN lte_registration TEXT,
  ADD COLUMN ppp_status TEXT,
  ADD COLUMN napt_status TEXT,
  ADD COLUMN ip_address TEXT,
  ADD COLUMN gnss_response TEXT,
  ADD COLUMN wifi_policy TEXT,
  ADD COLUMN ap_status TEXT,
  ADD COLUMN reported_max_clients INTEGER,
  ADD COLUMN last_recovery_reason TEXT,
  ADD COLUMN last_modem_recovery_at TIMESTAMPTZ,
  ADD COLUMN last_gnss_recovery_at TIMESTAMPTZ,
  ADD COLUMN reset_reason TEXT,
  ADD COLUMN power_source TEXT,
  ADD COLUMN vehicle_battery_voltage NUMERIC,
  ADD COLUMN acc_state TEXT,
  ADD COLUMN power_mode TEXT;

ALTER TABLE gps_commands
  ADD COLUMN actor_label TEXT;

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
    'set_max_wifi_clients'
  ));

ALTER TABLE gps_commands DROP CONSTRAINT gps_commands_status_chk;
ALTER TABLE gps_commands
  ADD CONSTRAINT gps_commands_status_chk CHECK (status IN (
    'queued',
    'delivered',
    'acked',
    'failed',
    'cancelled',
    'expired'
  ));

COMMENT ON COLUMN gps_devices.device_code IS
  'Hardware device id printed for firmware, for example TPT-1CDBD4475D88.';
COMMENT ON COLUMN gps_devices.wifi_max_clients IS
  'Desired passenger Wi-Fi client limit. Sent to the device with set_max_wifi_clients.';
COMMENT ON COLUMN gps_device_status.vehicle_battery_voltage IS
  'Reported by the device heartbeat only. Null means the device has not reported it.';
