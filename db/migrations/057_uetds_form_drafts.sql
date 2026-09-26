-- Temporary structured U-ETDS Yeni Bildirim drafts.
-- TTL is created_at + 12 hours and is not extended by autosave.
-- Files, images, credentials and ministry secrets are never stored.

CREATE TABLE IF NOT EXISTS uetds_form_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('partner', 'ops')),
  actor_user_id UUID NOT NULL,
  partner_id UUID REFERENCES partners (id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations (id) ON DELETE CASCADE,
  scope_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uetds_form_drafts_partner_scope_chk
    CHECK (
      (actor_type = 'partner' AND partner_id IS NOT NULL)
      OR (actor_type = 'ops' AND partner_id IS NULL)
    ),
  CONSTRAINT uetds_form_drafts_scope_key_chk
    CHECK (scope_key = 'manual' OR char_length(scope_key) = 36)
);

CREATE UNIQUE INDEX IF NOT EXISTS uetds_form_drafts_owner_scope_uidx
  ON uetds_form_drafts (actor_type, actor_user_id, scope_key);

CREATE INDEX IF NOT EXISTS uetds_form_drafts_created_idx
  ON uetds_form_drafts (created_at);

COMMENT ON TABLE uetds_form_drafts IS
  'Server-side U-ETDS notification form drafts. Expire 12 hours after created_at.';
COMMENT ON COLUMN uetds_form_drafts.created_at IS
  'TTL start. Autosave updates must not change this value.';

REVOKE ALL ON TABLE uetds_form_drafts FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE uetds_form_drafts TO tripetica_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE uetds_form_drafts TO tripetica_dev_app;
  END IF;
END
$$;
