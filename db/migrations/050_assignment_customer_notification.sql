-- Manual Ops-only customer assignment notifications.
-- Additive. Does not rewrite assignment columns, confirmation mail, or partner portal.

CREATE TABLE IF NOT EXISTS reservation_assignment_customer_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations (id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_by_ops_user_id UUID REFERENCES ops_users (id),
  notification_scope TEXT NOT NULL,
  reservation_locale TEXT NOT NULL,
  vehicle_kind TEXT,
  vehicle_id UUID,
  vehicle_plate TEXT NOT NULL,
  vehicle_name TEXT NOT NULL,
  vehicle_snapshot JSONB,
  driver_kind TEXT,
  driver_id UUID,
  driver_name TEXT,
  driver_phone TEXT,
  driver_snapshot JSONB,
  fingerprint TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  smtp_message_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reservation_assignment_customer_notification_status_chk
    CHECK (status IN ('sent', 'failed')),
  CONSTRAINT reservation_assignment_customer_notification_scope_chk
    CHECK (notification_scope IN ('vehicle_only', 'vehicle_and_driver')),
  CONSTRAINT reservation_assignment_customer_notification_locale_chk
    CHECK (reservation_locale IN ('tr', 'en', 'ru', 'ar')),
  CONSTRAINT reservation_assignment_customer_notification_vehicle_kind_chk
    CHECK (vehicle_kind IS NULL OR vehicle_kind IN ('registered', 'non_trp')),
  CONSTRAINT reservation_assignment_customer_notification_driver_kind_chk
    CHECK (driver_kind IS NULL OR driver_kind IN ('registered', 'non_trp')),
  CONSTRAINT reservation_assignment_customer_notification_scope_driver_chk
    CHECK (
      (
        notification_scope = 'vehicle_only'
        AND driver_kind IS NULL
        AND driver_id IS NULL
        AND driver_name IS NULL
        AND driver_phone IS NULL
        AND driver_snapshot IS NULL
      )
      OR (
        notification_scope = 'vehicle_and_driver'
        AND driver_name IS NOT NULL
        AND driver_phone IS NOT NULL
      )
    )
);

CREATE INDEX IF NOT EXISTS reservation_assignment_customer_notification_last_idx
  ON reservation_assignment_customer_notifications (reservation_id, sent_at DESC)
  WHERE status = 'sent';

CREATE INDEX IF NOT EXISTS reservation_assignment_customer_notification_history_idx
  ON reservation_assignment_customer_notifications (reservation_id, sent_at DESC);

COMMENT ON TABLE reservation_assignment_customer_notifications IS
  'Append-only Ops customer assignment notification attempts. Last successful snapshot is the latest status=sent row.';

COMMENT ON COLUMN reservation_assignment_customer_notifications.fingerprint IS
  'Normalized vehicle/driver/scope fingerprint used to reject no-change resends.';

COMMENT ON COLUMN reservation_assignment_customer_notifications.recipient_email IS
  'Customer email copied from the reservation at send time. Never accepted from the client.';

REVOKE ALL ON TABLE reservation_assignment_customer_notifications FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT ON TABLE reservation_assignment_customer_notifications
      TO tripetica_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT ON TABLE reservation_assignment_customer_notifications
      TO tripetica_dev_app;
  END IF;
END
$$;
