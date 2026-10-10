-- Teltonika immobilizer request and audit. ESP32 commands and ATS settings are untouched.
-- A missing row means no device report: the output is unknown, not off.

CREATE TABLE gps_immobilizer_status (
  device_id UUID PRIMARY KEY REFERENCES gps_devices (id) ON DELETE CASCADE,
  request TEXT NOT NULL DEFAULT 'off',
  output_state TEXT NOT NULL DEFAULT 'unknown',
  output_observed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gps_immobilizer_status_request_chk CHECK (request IN ('off', 'on')),
  CONSTRAINT gps_immobilizer_status_output_chk CHECK (output_state IN ('unknown', 'off', 'on'))
);

COMMENT ON TABLE gps_immobilizer_status IS
  'User request and device-reported DOUT1. DOUT1 is not proof that the engine is physically blocked.';

CREATE TABLE gps_immobilizer_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES gps_devices (id) ON DELETE CASCADE,
  vehicle_id UUID,
  partner_id UUID,
  actor_label TEXT NOT NULL,
  surface TEXT NOT NULL,
  request TEXT NOT NULL,
  command_text TEXT NOT NULL,
  phase TEXT NOT NULL,
  response_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gps_immobilizer_commands_actor_chk CHECK (char_length(actor_label) BETWEEN 1 AND 120),
  CONSTRAINT gps_immobilizer_commands_surface_chk CHECK (surface IN ('ops', 'partner')),
  CONSTRAINT gps_immobilizer_commands_request_chk CHECK (request IN ('off', 'on')),
  CONSTRAINT gps_immobilizer_commands_phase_chk CHECK (
    phase IN ('withheld', 'queued', 'sent', 'acknowledged', 'rejected', 'timeout')
  )
);

CREATE INDEX gps_immobilizer_commands_device_idx
  ON gps_immobilizer_commands (device_id, created_at DESC);

CREATE UNIQUE INDEX gps_immobilizer_inflight_uidx
  ON gps_immobilizer_commands (device_id)
  WHERE phase IN ('queued', 'sent');

COMMENT ON TABLE gps_immobilizer_commands IS
  'Audit of immobilizer requests and device replies. withheld means the socket command was not sent.';

REVOKE ALL ON TABLE gps_immobilizer_status FROM PUBLIC;
REVOKE ALL ON TABLE gps_immobilizer_commands FROM PUBLIC;
