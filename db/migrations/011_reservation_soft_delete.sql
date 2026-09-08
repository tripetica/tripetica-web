-- Soft-delete support for confirmed reservations in the ops panel.

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_ops_user_id UUID REFERENCES ops_users (id);

CREATE INDEX IF NOT EXISTS reservations_deleted_at_idx
  ON reservations (deleted_at)
  WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN reservations.deleted_at IS
  'When set, the reservation is hidden from ops lists but retained with passengers and audit history.';
COMMENT ON COLUMN reservations.deleted_by_ops_user_id IS
  'Ops user who soft-deleted this reservation.';
