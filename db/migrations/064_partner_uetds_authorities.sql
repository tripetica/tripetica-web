-- Uses the existing UETDS_CREDENTIALS_KEY sealed-secret infrastructure.
CREATE TABLE partner_uetds_authorities (
  partner_id UUID PRIMARY KEY REFERENCES partners(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (length(full_name) BETWEEN 1 AND 150),
  identity_sealed TEXT NOT NULL CHECK (identity_sealed LIKE 'v1.%'),
  identity_last4 TEXT NOT NULL CHECK (identity_last4 ~ '^[0-9]{4}$'),
  password_sealed TEXT NOT NULL CHECK (password_sealed LIKE 'v1.%'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
REVOKE ALL ON TABLE partner_uetds_authorities FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE partner_uetds_authorities TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE partner_uetds_authorities TO tripetica_app;
  END IF;
END
$$;
