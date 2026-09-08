-- Keep at most one live Ana Partner. Soft-deleted rows must not occupy the slot.
-- Additive: does not rewrite partner rows, bookings, or ops users.

DROP INDEX IF EXISTS partners_one_primary_uidx;

CREATE UNIQUE INDEX partners_one_primary_uidx
  ON partners (is_primary_partner)
  WHERE is_primary_partner AND deleted_at IS NULL;
