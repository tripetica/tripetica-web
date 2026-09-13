-- Controlled technical retries for assignment-missing reminders.
-- Additive. Does not rewrite assignment columns or 048 unique slot/channel keys.

ALTER TABLE reservation_assignment_alarm_deliveries
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

ALTER TABLE reservation_assignment_alarm_deliveries
  DROP CONSTRAINT IF EXISTS reservation_assignment_alarm_attempt_chk;

ALTER TABLE reservation_assignment_alarm_deliveries
  ADD CONSTRAINT reservation_assignment_alarm_attempt_chk
  CHECK (attempt_count >= 1 AND attempt_count <= 20);

CREATE INDEX IF NOT EXISTS reservation_assignment_alarm_retry_idx
  ON reservation_assignment_alarm_deliveries (next_retry_at)
  WHERE status = 'failed' AND next_retry_at IS NOT NULL;

COMMENT ON COLUMN reservation_assignment_alarm_deliveries.attempt_count IS
  'Finished or in-flight attempts for this reservation + slot + channel.';

COMMENT ON COLUMN reservation_assignment_alarm_deliveries.next_retry_at IS
  'Technical-failure retry time. NULL after success, dry-run, or exhausted attempts.';

CREATE TABLE IF NOT EXISTS assignment_alarm_dev_probes (
  probe_key TEXT PRIMARY KEY,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  provider_reference TEXT,
  error TEXT,
  CONSTRAINT assignment_alarm_dev_probes_key_chk
    CHECK (char_length(probe_key) BETWEEN 4 AND 80),
  CONSTRAINT assignment_alarm_dev_probes_status_chk
    CHECK (status IN ('claimed', 'sent', 'failed'))
);

COMMENT ON TABLE assignment_alarm_dev_probes IS
  'DEV-only one-shot probes. Not used by production reservation alarms.';

REVOKE ALL ON TABLE assignment_alarm_dev_probes FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE assignment_alarm_dev_probes
      TO tripetica_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE assignment_alarm_dev_probes
      TO tripetica_dev_app;
  END IF;
END
$$;
