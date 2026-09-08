-- Partner companies and partner users (separate from ops_users and customer_users).
-- Sessions and login throttling are isolated from ops and customer auth.

CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_code TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  is_primary_partner BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT partners_code_chk CHECK (partner_code ~ '^PTR-[0-9]{4}$'),
  CONSTRAINT partners_name_chk CHECK (char_length(name) BETWEEN 1 AND 120),
  CONSTRAINT partners_status_chk CHECK (status IN ('active', 'inactive'))
);

CREATE UNIQUE INDEX partners_code_uidx ON partners (partner_code);
CREATE UNIQUE INDEX partners_one_primary_uidx
  ON partners (is_primary_partner)
  WHERE is_primary_partner;

CREATE TRIGGER partners_set_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE partner_code_seq (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  last_seq INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT partner_code_seq_singleton CHECK (id),
  CONSTRAINT partner_code_seq_range_chk
    CHECK (last_seq >= 0 AND last_seq <= 9999)
);

INSERT INTO partner_code_seq (id, last_seq) VALUES (TRUE, 0);

CREATE TABLE partner_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners (id),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  CONSTRAINT partner_users_email_chk CHECK (char_length(email) BETWEEN 3 AND 254),
  CONSTRAINT partner_users_role_chk CHECK (role IN ('admin')),
  CONSTRAINT partner_users_status_chk CHECK (status IN ('active', 'inactive'))
);

CREATE UNIQUE INDEX partner_users_email_lower_uidx ON partner_users (lower(email));
CREATE INDEX partner_users_partner_id_idx ON partner_users (partner_id);

CREATE TRIGGER partner_users_set_updated_at
  BEFORE UPDATE ON partner_users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE partner_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES partner_users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX partner_sessions_user_id_idx ON partner_sessions (user_id);
CREATE INDEX partner_sessions_expires_at_idx ON partner_sessions (expires_at);

CREATE TABLE partner_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_key TEXT NOT NULL,
  ip TEXT,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX partner_login_attempts_email_time_idx
  ON partner_login_attempts (email_key, attempted_at DESC);
CREATE INDEX partner_login_attempts_ip_time_idx
  ON partner_login_attempts (ip, attempted_at DESC);

REVOKE ALL ON TABLE
  partners,
  partner_code_seq,
  partner_users,
  partner_sessions,
  partner_login_attempts
FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  partners,
  partner_code_seq,
  partner_users,
  partner_sessions,
  partner_login_attempts
TO tripetica_app;
