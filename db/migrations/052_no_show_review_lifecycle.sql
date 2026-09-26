-- Additive No Show review lifecycle for Transfer reservations.
-- Does not rewrite reservations.pickup_at, Driver Task tokens, or flight tracking.

ALTER TABLE reservation_driver_no_show_reports
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES ops_users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operations_note TEXT;

ALTER TABLE reservation_driver_no_show_reports
  DROP CONSTRAINT IF EXISTS reservation_driver_no_show_reports_review_status_chk;

ALTER TABLE reservation_driver_no_show_reports
  ADD CONSTRAINT reservation_driver_no_show_reports_review_status_chk
  CHECK (review_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS reservation_driver_no_show_reports_review_status_idx
  ON reservation_driver_no_show_reports (review_status);

COMMENT ON COLUMN reservation_driver_no_show_reports.review_status IS
  'pending = driver report awaiting ops; approved = No Show; rejected = Hizmet Gerçekleşmedi.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE reservation_driver_no_show_reports TO tripetica_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE reservation_driver_no_show_reports TO tripetica_dev_app;
  END IF;
END
$$;
