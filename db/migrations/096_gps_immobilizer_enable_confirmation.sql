-- One-time confirmation before an engine-block enable request.
-- Opening this row does not write a digital output and does not change capability flags.

CREATE TABLE gps_immobilizer_enable_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES gps_devices (id) ON DELETE CASCADE,
  surface TEXT NOT NULL,
  actor_key TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gps_immobilizer_enable_surface_chk CHECK (surface IN ('ops', 'partner')),
  CONSTRAINT gps_immobilizer_enable_actor_chk CHECK (char_length(actor_key) BETWEEN 1 AND 80)
);

CREATE INDEX gps_immobilizer_enable_device_idx
  ON gps_immobilizer_enable_confirmations (device_id, created_at DESC);

COMMENT ON TABLE gps_immobilizer_enable_confirmations IS
  'A server-issued enable confirmation. The first switch action cannot create an immobilizer command.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE gps_immobilizer_enable_confirmations TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE gps_immobilizer_enable_confirmations TO tripetica_app;
  END IF;
END
$$;
