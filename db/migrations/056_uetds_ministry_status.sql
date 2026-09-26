-- DEV-only notification statuses for TEST ministry responses.
ALTER TABLE uetds_notifications
  DROP CONSTRAINT IF EXISTS uetds_notifications_status_check;

ALTER TABLE uetds_notifications
  ADD CONSTRAINT uetds_notifications_status_check
    CHECK (status IN ('recorded', 'submitted', 'partial', 'failed'));

COMMENT ON COLUMN uetds_notifications.status IS
  'recorded=local only; submitted=TEST ministry success; partial=some stages saved; failed=ministry rejected.';
