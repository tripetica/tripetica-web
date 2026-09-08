-- Partner self-application profile, ops priority/audit, and pending status.
-- Additive only: keeps PTR-0001 and does not rewrite booking or employer billing.

ALTER TABLE partners
  DROP CONSTRAINT partners_status_chk;

ALTER TABLE partners
  ADD CONSTRAINT partners_status_chk
  CHECK (status IN ('pending', 'active', 'inactive'));

ALTER TABLE partners
  DROP CONSTRAINT partners_name_chk;

ALTER TABLE partners
  ADD CONSTRAINT partners_name_chk
  CHECK (char_length(name) BETWEEN 1 AND 240);

ALTER TABLE partner_users
  DROP CONSTRAINT partner_users_status_chk;

ALTER TABLE partner_users
  ADD CONSTRAINT partner_users_status_chk
  CHECK (status IN ('pending', 'active', 'inactive'));

ALTER TABLE partners
  ADD COLUMN business_type TEXT,
  ADD COLUMN address_line TEXT,
  ADD COLUMN country_code TEXT,
  ADD COLUMN tax_office TEXT,
  ADD COLUMN tax_number TEXT,
  ADD COLUMN contact_first_name TEXT,
  ADD COLUMN contact_last_name TEXT,
  ADD COLUMN phone TEXT,
  ADD COLUMN phone_country_code TEXT,
  ADD COLUMN priority_level INTEGER,
  ADD COLUMN applied_at TIMESTAMPTZ,
  ADD COLUMN activated_at TIMESTAMPTZ,
  ADD COLUMN activated_by_ops_user_id UUID REFERENCES ops_users (id),
  ADD COLUMN last_edited_by_ops_user_id UUID REFERENCES ops_users (id);

ALTER TABLE partners
  ADD CONSTRAINT partners_business_type_chk
  CHECK (business_type IS NULL OR business_type IN ('individual', 'company'));

ALTER TABLE partners
  ADD CONSTRAINT partners_country_code_chk
  CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');

ALTER TABLE partners
  ADD CONSTRAINT partners_phone_country_code_chk
  CHECK (phone_country_code IS NULL OR phone_country_code ~ '^[A-Z]{2}$');

ALTER TABLE partners
  ADD CONSTRAINT partners_priority_level_chk
  CHECK (priority_level IS NULL OR priority_level IN (1, 2, 3));

ALTER TABLE partners
  ADD CONSTRAINT partners_primary_no_priority_chk
  CHECK (NOT is_primary_partner OR priority_level IS NULL);

ALTER TABLE partners
  ADD CONSTRAINT partners_address_len_chk
  CHECK (address_line IS NULL OR char_length(address_line) BETWEEN 1 AND 500);

ALTER TABLE partners
  ADD CONSTRAINT partners_tax_office_len_chk
  CHECK (tax_office IS NULL OR char_length(tax_office) BETWEEN 1 AND 120);

ALTER TABLE partners
  ADD CONSTRAINT partners_tax_number_len_chk
  CHECK (tax_number IS NULL OR char_length(tax_number) BETWEEN 1 AND 32);

ALTER TABLE partners
  ADD CONSTRAINT partners_contact_first_name_len_chk
  CHECK (contact_first_name IS NULL OR char_length(contact_first_name) BETWEEN 1 AND 80);

ALTER TABLE partners
  ADD CONSTRAINT partners_contact_last_name_len_chk
  CHECK (contact_last_name IS NULL OR char_length(contact_last_name) BETWEEN 1 AND 80);

ALTER TABLE partners
  ADD CONSTRAINT partners_phone_len_chk
  CHECK (phone IS NULL OR char_length(phone) BETWEEN 5 AND 32);

ALTER TABLE ops_push_events
  DROP CONSTRAINT ops_push_events_type_chk;

ALTER TABLE ops_push_events
  ADD CONSTRAINT ops_push_events_type_chk
  CHECK (
    event_type IN (
      'process_created',
      'reservation_confirmed',
      'partner_application_created'
    )
  );
