-- Internal operations users, sessions, login throttling, and daily reservation codes.
-- Separate from any future customer account namespace.

CREATE TABLE ops_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  CONSTRAINT ops_users_role_chk CHECK (role IN ('owner', 'employee')),
  CONSTRAINT ops_users_email_chk CHECK (char_length(email) BETWEEN 3 AND 254)
);

CREATE UNIQUE INDEX ops_users_email_lower_uidx ON ops_users (lower(email));

CREATE TRIGGER ops_users_set_updated_at
  BEFORE UPDATE ON ops_users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE ops_user_permissions (
  user_id UUID NOT NULL REFERENCES ops_users (id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, permission_key)
);

CREATE TABLE ops_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ops_users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ops_sessions_user_id_idx ON ops_sessions (user_id);
CREATE INDEX ops_sessions_expires_at_idx ON ops_sessions (expires_at);

CREATE TABLE ops_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_key TEXT NOT NULL,
  ip TEXT,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ops_login_attempts_email_time_idx
  ON ops_login_attempts (email_key, attempted_at DESC);
CREATE INDEX ops_login_attempts_ip_time_idx
  ON ops_login_attempts (ip, attempted_at DESC);

CREATE TABLE reservation_code_daily_seq (
  day DATE PRIMARY KEY,
  last_seq INTEGER NOT NULL,
  CONSTRAINT reservation_code_daily_seq_range_chk
    CHECK (last_seq >= 1 AND last_seq <= 9999)
);

REVOKE ALL ON TABLE
  ops_users,
  ops_user_permissions,
  ops_sessions,
  ops_login_attempts,
  reservation_code_daily_seq
FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  ops_users,
  ops_user_permissions,
  ops_sessions,
  ops_login_attempts,
  reservation_code_daily_seq
TO tripetica_app;
