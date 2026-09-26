-- Airport-pickup DHMİ flight tracking + driver No Show ops reports.
-- Additive. Does not rewrite reservations.pickup_at, Driver Task tokens, or assignment.

CREATE TABLE IF NOT EXISTS reservation_flight_tracking (
  reservation_id UUID PRIMARY KEY REFERENCES reservations (id) ON DELETE CASCADE,
  scheduled_arrival TIMESTAMPTZ,
  estimated_arrival TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  status_text TEXT,
  status_id INTEGER,
  source TEXT NOT NULL DEFAULT 'dhmi',
  last_checked_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reservation_flight_tracking_source_chk
    CHECK (source IN ('dhmi'))
);

COMMENT ON TABLE reservation_flight_tracking IS
  'Operational DHMİ flight times for airport-pickup reservations. Never writes reservations.pickup_at.';

COMMENT ON COLUMN reservation_flight_tracking.actual_arrival IS
  'Set only from DHMİ exactTime after a landed/arrived signal. Estimated time is never stored here.';

CREATE INDEX IF NOT EXISTS reservation_flight_tracking_due_idx
  ON reservation_flight_tracking (last_checked_at, actual_arrival, locked_until);

CREATE TABLE IF NOT EXISTS reservation_driver_no_show_reports (
  reservation_id UUID PRIMARY KEY REFERENCES reservations (id) ON DELETE CASCADE,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  arrived_at TIMESTAMPTZ,
  driver_kind TEXT,
  driver_id UUID,
  driver_fingerprint TEXT,
  event_source TEXT NOT NULL DEFAULT 'driver_link',
  CONSTRAINT reservation_driver_no_show_reports_source_chk
    CHECK (event_source IN ('driver_link')),
  CONSTRAINT reservation_driver_no_show_reports_driver_kind_chk
    CHECK (driver_kind IS NULL OR driver_kind IN ('registered', 'non_trp'))
);

COMMENT ON TABLE reservation_driver_no_show_reports IS
  'Driver-submitted No Show review flags. Does not cancel, complete, or financially close the reservation.';

ALTER TABLE ops_push_events
  DROP CONSTRAINT IF EXISTS ops_push_events_type_chk;

ALTER TABLE ops_push_events
  ADD CONSTRAINT ops_push_events_type_chk
  CHECK (
    event_type IN (
      'process_created',
      'reservation_confirmed',
      'partner_application_created',
      'partner_vehicle_approval_requested',
      'driver_no_show_reported'
    )
  );

REVOKE ALL ON TABLE reservation_flight_tracking FROM PUBLIC;
REVOKE ALL ON TABLE reservation_driver_no_show_reports FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE reservation_flight_tracking TO tripetica_app;
    GRANT SELECT, INSERT ON TABLE reservation_driver_no_show_reports TO tripetica_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE reservation_flight_tracking TO tripetica_dev_app;
    GRANT SELECT, INSERT ON TABLE reservation_driver_no_show_reports TO tripetica_dev_app;
  END IF;
END
$$;
