-- Singleton official employer/company billing profile.
-- Shared by every partner; not copied onto partner rows.

CREATE TABLE employer_billing_profile (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  legal_name TEXT NOT NULL,
  tax_office TEXT NOT NULL,
  tax_number TEXT NOT NULL,
  address_line TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  authorized_person TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employer_billing_profile_singleton CHECK (id),
  CONSTRAINT employer_billing_profile_legal_name_chk
    CHECK (char_length(legal_name) BETWEEN 1 AND 240),
  CONSTRAINT employer_billing_profile_tax_office_chk
    CHECK (char_length(tax_office) BETWEEN 1 AND 120),
  CONSTRAINT employer_billing_profile_tax_number_chk
    CHECK (char_length(tax_number) BETWEEN 1 AND 32),
  CONSTRAINT employer_billing_profile_address_chk
    CHECK (char_length(address_line) BETWEEN 1 AND 400),
  CONSTRAINT employer_billing_profile_email_chk
    CHECK (char_length(email) BETWEEN 3 AND 254),
  CONSTRAINT employer_billing_profile_phone_chk
    CHECK (char_length(phone) BETWEEN 1 AND 40),
  CONSTRAINT employer_billing_profile_authorized_chk
    CHECK (char_length(authorized_person) BETWEEN 1 AND 120)
);

CREATE TRIGGER employer_billing_profile_set_updated_at
  BEFORE UPDATE ON employer_billing_profile
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

INSERT INTO employer_billing_profile (
  id,
  legal_name,
  tax_office,
  tax_number,
  address_line,
  email,
  phone,
  authorized_person
) VALUES (
  TRUE,
  'Search Travel Agency Turizm Taşımacılık Ticaret Limited Şirketi',
  'Güneşli Vergi Dairesi',
  '4880975612',
  '15 Temmuz Mah. 1500. Sk. Ark Residence 14, D:40 Bağcılar / İstanbul',
  'info@tripetica.com',
  '+90 533 205 82 19',
  'Recep YILDIRIM'
);

REVOKE ALL ON TABLE employer_billing_profile FROM PUBLIC;

GRANT SELECT ON TABLE employer_billing_profile TO tripetica_app;
