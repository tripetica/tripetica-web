-- Remote restart attempts for the DEV configurator.
-- This migration stores state only. It does not insert a command and it does not reset a device.

CREATE TABLE gps_teltonika_links (
  device_id UUID PRIMARY KEY REFERENCES gps_devices (id),
  imei TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL,
  disconnected_at TIMESTAMPTZ
);

CREATE TABLE gps_device_restarts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES gps_devices (id),
  phase TEXT NOT NULL CHECK (phase IN (
    'no_link',
    'preparing',
    'armed',
    'sent',
    'waiting_reconnect',
    'verified',
    'unverified',
    'failed'
  )),
  error TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  reconnected_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE INDEX gps_device_restarts_device_idx ON gps_device_restarts (device_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON gps_teltonika_links, gps_device_restarts TO tripetica_dev_app;
GRANT SELECT, INSERT, UPDATE ON gps_teltonika_links, gps_device_restarts TO tripetica_app;
