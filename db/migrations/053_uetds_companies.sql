-- Central U-ETDS carrier companies for any authorized transporter.
-- Soft status only: inactive companies stay for future notification/audit history.
-- TEST/CANLI passwords are stored sealed (AES-GCM), never as plaintext.

CREATE TABLE uetds_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_name TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  tax_number TEXT NOT NULL,
  authority_document_type TEXT NOT NULL,
  authority_document_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  integration_status TEXT NOT NULL DEFAULT 'incomplete',
  test_username TEXT,
  test_password_sealed TEXT,
  live_username TEXT,
  live_password_sealed TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uetds_companies_short_name_chk
    CHECK (char_length(short_name) BETWEEN 1 AND 120),
  CONSTRAINT uetds_companies_legal_name_chk
    CHECK (char_length(legal_name) BETWEEN 1 AND 240),
  CONSTRAINT uetds_companies_tax_number_chk
    CHECK (char_length(tax_number) BETWEEN 1 AND 32),
  CONSTRAINT uetds_companies_authority_type_chk
    CHECK (authority_document_type IN ('D1', 'D2')),
  CONSTRAINT uetds_companies_authority_number_chk
    CHECK (char_length(authority_document_number) BETWEEN 1 AND 64),
  CONSTRAINT uetds_companies_status_chk
    CHECK (status IN ('active', 'inactive')),
  CONSTRAINT uetds_companies_integration_status_chk
    CHECK (integration_status IN ('incomplete', 'ready', 'error')),
  CONSTRAINT uetds_companies_test_username_chk
    CHECK (test_username IS NULL OR char_length(test_username) BETWEEN 1 AND 120),
  CONSTRAINT uetds_companies_live_username_chk
    CHECK (live_username IS NULL OR char_length(live_username) BETWEEN 1 AND 120)
);

CREATE INDEX uetds_companies_status_idx ON uetds_companies (status);
CREATE INDEX uetds_companies_updated_at_idx ON uetds_companies (updated_at DESC);
CREATE INDEX uetds_companies_search_idx ON uetds_companies (short_name, legal_name, tax_number);

CREATE TRIGGER uetds_companies_set_updated_at
  BEFORE UPDATE ON uetds_companies
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE uetds_companies IS
  'Carrier companies that can later submit U-ETDS notifications. Not limited to a single firm.';
COMMENT ON COLUMN uetds_companies.status IS
  'Business status: active or inactive. Inactive is not a delete.';
COMMENT ON COLUMN uetds_companies.integration_status IS
  'Config completeness or later connection result: incomplete, ready, error. ready is not a live ministry test.';
COMMENT ON COLUMN uetds_companies.test_password_sealed IS
  'AES-GCM sealed TEST web-service password. Never return to clients.';
COMMENT ON COLUMN uetds_companies.live_password_sealed IS
  'AES-GCM sealed LIVE web-service password. Never return to clients.';

REVOKE ALL ON TABLE uetds_companies FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE uetds_companies TO tripetica_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE uetds_companies TO tripetica_dev_app;
  END IF;
END
$$;
