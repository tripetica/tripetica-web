-- One partner can keep several e-Devlet authorities, each linked to one or more
-- active U-ETDS companies. Existing sealed identity/password values are kept
-- in place and are never decrypted or rewritten by this migration.

ALTER TABLE partner_uetds_authorities
  DROP CONSTRAINT partner_uetds_authorities_pkey;

ALTER TABLE partner_uetds_authorities
  ADD COLUMN id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN first_name TEXT,
  ADD COLUMN last_name TEXT,
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE partner_uetds_authorities
  ADD CONSTRAINT partner_uetds_authorities_pkey PRIMARY KEY (id);

UPDATE partner_uetds_authorities
SET
  first_name = COALESCE(NULLIF(btrim(
    CASE
      WHEN strpos(btrim(full_name), ' ') = 0 THEN btrim(full_name)
      ELSE regexp_replace(btrim(full_name), '\s+\S+$', '')
    END
  ), ''), '—'),
  last_name = COALESCE(NULLIF(btrim(
    CASE
      WHEN strpos(btrim(full_name), ' ') = 0 THEN '—'
      ELSE substring(btrim(full_name) FROM '\S+$')
    END
  ), ''), '—')
WHERE first_name IS NULL OR last_name IS NULL;

ALTER TABLE partner_uetds_authorities
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name SET NOT NULL;

ALTER TABLE partner_uetds_authorities
  DROP CONSTRAINT IF EXISTS partner_uetds_authorities_status_chk,
  DROP CONSTRAINT IF EXISTS partner_uetds_authorities_first_name_chk,
  DROP CONSTRAINT IF EXISTS partner_uetds_authorities_last_name_chk;

ALTER TABLE partner_uetds_authorities
  ADD CONSTRAINT partner_uetds_authorities_status_chk
    CHECK (status IN ('active', 'inactive')),
  ADD CONSTRAINT partner_uetds_authorities_first_name_chk
    CHECK (char_length(btrim(first_name)) BETWEEN 1 AND 80),
  ADD CONSTRAINT partner_uetds_authorities_last_name_chk
    CHECK (char_length(btrim(last_name)) BETWEEN 1 AND 80);

ALTER TABLE partner_uetds_authorities
  DROP COLUMN full_name;

CREATE INDEX IF NOT EXISTS partner_uetds_authorities_partner_active_idx
  ON partner_uetds_authorities (partner_id)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE partner_uetds_authorities IS
  'Partner e-Devlet authorities. identity_sealed and password_sealed stay AES-GCM ciphertext.';
COMMENT ON COLUMN partner_uetds_authorities.status IS
  'active or inactive. Inactive is not a delete.';
COMMENT ON COLUMN partner_uetds_authorities.deleted_at IS
  'Soft delete. Rows stay for credential history and are hidden from partner lists.';

CREATE TABLE IF NOT EXISTS partner_uetds_authority_companies (
  authority_id UUID NOT NULL REFERENCES partner_uetds_authorities (id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES uetds_companies (id),
  PRIMARY KEY (authority_id, company_id)
);

COMMENT ON TABLE partner_uetds_authority_companies IS
  'U-ETDS companies an e-Devlet authority may act for. Many companies per authority.';

REVOKE ALL ON TABLE partner_uetds_authority_companies FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE partner_uetds_authority_companies TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE partner_uetds_authority_companies TO tripetica_app;
  END IF;
END
$$;
