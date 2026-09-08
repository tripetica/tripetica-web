-- Reservation outbound email idempotency markers.
-- Set only after SMTP delivery succeeds (application-level).

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS reservation_confirmation_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_confirmation_email_sent_at TIMESTAMPTZ;
