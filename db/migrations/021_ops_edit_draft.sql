-- Ops edit session: mark which ops user started an edit draft (not customer impersonation).
-- Customer edit drafts keep editing_ops_user_id NULL.

ALTER TABLE reservation_searches
  ADD COLUMN IF NOT EXISTS editing_ops_user_id UUID
    REFERENCES ops_users (id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS reservation_searches_editing_ops_user_id_idx
  ON reservation_searches (editing_ops_user_id)
  WHERE editing_ops_user_id IS NOT NULL;
