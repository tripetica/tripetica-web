-- DEV record of a controlled mobile ATS test send.
-- Physical gps_ats_submissions stays tied to gps_positions.
-- ministry_env is test-only so this table cannot store a live send.

CREATE TABLE gps_mobile_ats_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES uetds_notifications (id),
  mobile_position_id UUID NOT NULL REFERENCES gps_mobile_positions (id),
  ministry_env TEXT NOT NULL CHECK (ministry_env = 'test'),
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed')),
  gnss_time TIMESTAMPTZ NOT NULL,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  sonuc_kodu INTEGER,
  sonuc_mesaji TEXT,
  response_body TEXT
);

CREATE INDEX gps_mobile_ats_submissions_notification_idx
  ON gps_mobile_ats_submissions (notification_id, queued_at DESC);

REVOKE ALL ON TABLE gps_mobile_ats_submissions FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT ON TABLE gps_mobile_ats_submissions TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT ON TABLE gps_mobile_ats_submissions TO tripetica_app;
  END IF;
END
$$;
