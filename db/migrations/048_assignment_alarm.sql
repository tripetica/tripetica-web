-- Assignment-missing reminder deliveries. Additive; does not rewrite
-- reservation assignment columns, mail queues, or emergency voice alerts.

CREATE TABLE IF NOT EXISTS reservation_assignment_alarm_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations (id) ON DELETE CASCADE,
  reminder_slot TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  provider_reference TEXT,
  error TEXT,
  CONSTRAINT reservation_assignment_alarm_channel_chk
    CHECK (channel IN ('email', 'voice')),
  CONSTRAINT reservation_assignment_alarm_status_chk
    CHECK (status IN ('claimed', 'sent', 'failed', 'dry_run')),
  CONSTRAINT reservation_assignment_alarm_slot_chk
    CHECK (char_length(reminder_slot) BETWEEN 8 AND 160),
  CONSTRAINT reservation_assignment_alarm_delivery_uidx
    UNIQUE (reservation_id, reminder_slot, channel)
);

CREATE INDEX IF NOT EXISTS reservation_assignment_alarm_reservation_idx
  ON reservation_assignment_alarm_deliveries (reservation_id, attempted_at DESC);

COMMENT ON TABLE reservation_assignment_alarm_deliveries IS
  'Idempotent assignment-missing reminder attempts. One row per reservation + pickup-scoped slot + channel.';

REVOKE ALL ON TABLE reservation_assignment_alarm_deliveries FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE reservation_assignment_alarm_deliveries
      TO tripetica_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE reservation_assignment_alarm_deliveries
      TO tripetica_dev_app;
  END IF;
END
$$;
