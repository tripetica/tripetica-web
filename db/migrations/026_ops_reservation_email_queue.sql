ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS operation_notification_email_queued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS operation_notification_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS operation_notification_email_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS operation_notification_email_next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS operation_notification_email_attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS operation_notification_email_last_error TEXT;

CREATE INDEX IF NOT EXISTS reservations_operation_notification_email_pending_idx
  ON reservations (
    operation_notification_email_next_attempt_at,
    operation_notification_email_queued_at
  )
  WHERE operation_notification_email_queued_at IS NOT NULL
    AND operation_notification_email_sent_at IS NULL;
