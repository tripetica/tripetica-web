-- Additive customer profile nationality and account-request throttling.

ALTER TABLE customer_users
  ADD COLUMN IF NOT EXISTS nationality_code CHAR(2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_users_nationality_code_chk'
      AND conrelid = 'customer_users'::regclass
  ) THEN
    ALTER TABLE customer_users
      ADD CONSTRAINT customer_users_nationality_code_chk
      CHECK (
        nationality_code IS NULL
        OR nationality_code ~ '^[A-Z]{2}$'
      );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS customer_auth_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL,
  email_key TEXT NOT NULL,
  ip TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_auth_requests_type_chk CHECK (
    request_type IN ('registration', 'password_reset')
  )
);

CREATE INDEX IF NOT EXISTS customer_auth_requests_email_time_idx
  ON customer_auth_requests (request_type, email_key, requested_at DESC);

CREATE INDEX IF NOT EXISTS customer_auth_requests_ip_time_idx
  ON customer_auth_requests (request_type, ip, requested_at DESC)
  WHERE ip IS NOT NULL;

CREATE INDEX IF NOT EXISTS customer_auth_requests_requested_at_idx
  ON customer_auth_requests (requested_at);

REVOKE ALL ON TABLE customer_auth_requests FROM PUBLIC;

GRANT SELECT, INSERT, DELETE ON TABLE customer_auth_requests TO tripetica_app;
