-- Registered-driver portal identity + hashed email OTP + isolated sessions.
-- Additive only. Does not rewrite NON-TRP assignment, Driver Task tokens, or partner/ops auth.

ALTER TABLE partner_drivers
  ADD COLUMN email TEXT;

ALTER TABLE partner_drivers
  ADD CONSTRAINT partner_drivers_email_chk
  CHECK (email IS NULL OR char_length(email) BETWEEN 3 AND 254);

CREATE UNIQUE INDEX partner_drivers_email_uidx
  ON partner_drivers (lower(email))
  WHERE email IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN partner_drivers.email IS
  'Optional portal login identity for registered drivers. Normalized lowercase. NULL on legacy rows.';

CREATE TABLE driver_portal_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  driver_id UUID REFERENCES partner_drivers (id),
  code_hash TEXT NOT NULL,
  code_salt TEXT NOT NULL,
  ip TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT driver_portal_challenges_email_chk
    CHECK (char_length(email) BETWEEN 3 AND 254),
  CONSTRAINT driver_portal_challenges_attempts_chk
    CHECK (attempt_count >= 0)
);

CREATE INDEX driver_portal_challenges_email_idx
  ON driver_portal_challenges (email, created_at DESC);

CREATE INDEX driver_portal_challenges_driver_open_idx
  ON driver_portal_challenges (driver_id, created_at DESC)
  WHERE driver_id IS NOT NULL AND consumed_at IS NULL;

CREATE INDEX driver_portal_challenges_ip_idx
  ON driver_portal_challenges (ip, created_at DESC)
  WHERE ip IS NOT NULL;

COMMENT ON TABLE driver_portal_challenges IS
  'Hashed one-time driver portal login codes. Raw OTP is never stored.';

CREATE TABLE driver_portal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES partner_drivers (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX driver_portal_sessions_driver_id_idx
  ON driver_portal_sessions (driver_id);

CREATE INDEX driver_portal_sessions_expires_at_idx
  ON driver_portal_sessions (expires_at);

COMMENT ON TABLE driver_portal_sessions IS
  'Isolated registered-driver portal sessions. Separate from ops/partner cookies.';

REVOKE ALL ON TABLE driver_portal_challenges FROM PUBLIC;
REVOKE ALL ON TABLE driver_portal_sessions FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE driver_portal_challenges TO tripetica_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE driver_portal_sessions TO tripetica_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE driver_portal_challenges TO tripetica_dev_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE driver_portal_sessions TO tripetica_dev_app;
  END IF;
END
$$;
