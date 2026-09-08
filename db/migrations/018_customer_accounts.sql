-- Customer accounts (separate from ops_users), sessions, email tokens, companies.
-- reservations.customer_user_id is nullable and unused by booking until a later task.

CREATE TABLE customer_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  phone_country_code TEXT,
  password_hash TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  pending_email TEXT,
  pending_email_requested_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  CONSTRAINT customer_users_email_chk CHECK (char_length(email) BETWEEN 3 AND 254),
  CONSTRAINT customer_users_pending_email_chk CHECK (
    pending_email IS NULL OR char_length(pending_email) BETWEEN 3 AND 254
  ),
  CONSTRAINT customer_users_name_chk CHECK (
    char_length(first_name) BETWEEN 1 AND 80
    AND char_length(last_name) BETWEEN 1 AND 80
  )
);

CREATE UNIQUE INDEX customer_users_email_lower_uidx ON customer_users (lower(email));
CREATE UNIQUE INDEX customer_users_pending_email_lower_uidx
  ON customer_users (lower(pending_email))
  WHERE pending_email IS NOT NULL;

CREATE TRIGGER customer_users_set_updated_at
  BEFORE UPDATE ON customer_users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE customer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES customer_users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX customer_sessions_user_id_idx ON customer_sessions (user_id);
CREATE INDEX customer_sessions_expires_at_idx ON customer_sessions (expires_at);

CREATE TABLE customer_auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES customer_users (id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  email_target TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_auth_tokens_purpose_chk CHECK (
    purpose IN ('email_verify', 'email_change', 'password_reset')
  )
);

CREATE INDEX customer_auth_tokens_user_purpose_idx
  ON customer_auth_tokens (user_id, purpose, created_at DESC);
CREATE INDEX customer_auth_tokens_expires_at_idx
  ON customer_auth_tokens (expires_at);

CREATE TABLE customer_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_key TEXT NOT NULL,
  ip TEXT,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX customer_login_attempts_email_time_idx
  ON customer_login_attempts (email_key, attempted_at DESC);
CREATE INDEX customer_login_attempts_ip_time_idx
  ON customer_login_attempts (ip, attempted_at DESC);

CREATE TABLE customer_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES customer_users (id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  country_code CHAR(2) NOT NULL,
  address_line TEXT NOT NULL,
  city TEXT NOT NULL,
  postal_code TEXT,
  tax_id TEXT,
  tax_office TEXT,
  invoice_email TEXT NOT NULL,
  phone TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_companies_name_chk CHECK (char_length(company_name) BETWEEN 1 AND 200),
  CONSTRAINT customer_companies_country_chk CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT customer_companies_invoice_email_chk CHECK (
    char_length(invoice_email) BETWEEN 3 AND 254
  ),
  CONSTRAINT customer_companies_tr_tax_office_chk CHECK (
    country_code <> 'TR' OR (tax_office IS NOT NULL AND char_length(tax_office) BETWEEN 1 AND 120)
  )
);

CREATE INDEX customer_companies_user_id_idx ON customer_companies (user_id);

CREATE UNIQUE INDEX customer_companies_one_default_uidx
  ON customer_companies (user_id)
  WHERE is_default;

CREATE TRIGGER customer_companies_set_updated_at
  BEFORE UPDATE ON customer_companies
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS customer_user_id UUID REFERENCES customer_users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS reservations_customer_user_id_idx
  ON reservations (customer_user_id)
  WHERE customer_user_id IS NOT NULL;

REVOKE ALL ON TABLE
  customer_users,
  customer_sessions,
  customer_auth_tokens,
  customer_login_attempts,
  customer_companies
FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  customer_users,
  customer_sessions,
  customer_auth_tokens,
  customer_login_attempts,
  customer_companies
TO tripetica_app;
