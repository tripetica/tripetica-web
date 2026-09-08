-- Extend the shared partner_drivers record used by Partner Portal and Ops.
-- Additive only: no booking rewrite, no vehicle changes, no partner-auth rewrite.

ALTER TABLE partner_drivers
  ADD COLUMN national_id TEXT,
  ADD COLUMN languages TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN last_edited_by_partner_user_id UUID REFERENCES partner_users (id),
  ADD COLUMN deleted_by_partner_user_id UUID REFERENCES partner_users (id);

ALTER TABLE partner_drivers
  ADD CONSTRAINT partner_drivers_national_id_chk
    CHECK (national_id IS NULL OR national_id ~ '^[0-9]{11}$');

CREATE UNIQUE INDEX partner_drivers_partner_national_id_uidx
  ON partner_drivers (partner_id, national_id)
  WHERE deleted_at IS NULL AND national_id IS NOT NULL;

COMMENT ON COLUMN partner_drivers.national_id IS
  'Turkish national ID (11 digits). Hidden on driver lists; visible on detail.';
COMMENT ON COLUMN partner_drivers.languages IS
  'Stable ISO 639-1 language codes spoken by the driver. Not display strings.';
