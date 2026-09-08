ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS reservation_confirmation_email_queued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reservation_confirmation_email_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reservation_confirmation_email_next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reservation_confirmation_email_attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reservation_confirmation_email_last_error TEXT;

CREATE INDEX IF NOT EXISTS reservations_confirmation_email_pending_idx
  ON reservations (
    reservation_confirmation_email_next_attempt_at,
    reservation_confirmation_email_queued_at
  )
  WHERE reservation_confirmation_email_queued_at IS NOT NULL
    AND reservation_confirmation_email_sent_at IS NULL;
