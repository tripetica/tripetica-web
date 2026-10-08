-- Current low-battery episode on device status. Not copied onto gps_positions.
-- The device owns the countdown. The server does not start a 600 second timer.

ALTER TABLE gps_device_status
  ADD COLUMN low_battery_state TEXT,
  ADD COLUMN low_battery_grace_remaining_seconds INTEGER,
  ADD COLUMN low_battery_episode_at TIMESTAMPTZ;

ALTER TABLE gps_device_status
  ADD CONSTRAINT gps_device_status_low_battery_state_chk
  CHECK (
    low_battery_state IS NULL
    OR low_battery_state IN ('normal', 'grace', 'keep_on', 'saving')
  );

ALTER TABLE gps_device_status
  ADD CONSTRAINT gps_device_status_low_battery_remaining_chk
  CHECK (
    low_battery_grace_remaining_seconds IS NULL
    OR (
      low_battery_grace_remaining_seconds >= 0
      AND low_battery_grace_remaining_seconds <= 7200
    )
  );

CREATE TABLE gps_low_battery_pushes (
  device_id UUID NOT NULL REFERENCES gps_devices (id) ON DELETE CASCADE,
  episode_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (device_id, episode_at)
);

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
    'wifi_config',
    'low_battery_action'
  ));

COMMENT ON COLUMN gps_device_status.low_battery_state IS
  'Firmware low-battery episode: normal, grace, keep_on, or saving.';
COMMENT ON COLUMN gps_device_status.low_battery_grace_remaining_seconds IS
  'Seconds the device still has in grace. Authoritative value comes from the heartbeat.';
COMMENT ON COLUMN gps_device_status.low_battery_episode_at IS
  'Start of the current grace episode. A later return to grace is a new episode.';
