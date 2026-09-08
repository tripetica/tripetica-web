-- Soft-delete partners without dropping operational history or related users.
ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_ops_user_id UUID REFERENCES ops_users (id);

CREATE INDEX IF NOT EXISTS partners_deleted_at_idx
  ON partners (deleted_at);

COMMENT ON COLUMN partners.deleted_at IS
  'Ops soft-delete timestamp. Deleted partners stay out of active lists and cannot log in.';
