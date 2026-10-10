-- Live mobile ATS uses the same ministry call as a physical device.
-- The phone measurement stays in gps_mobile_positions. It is not copied into gps_positions.
-- One row per vehicle per two-minute slot, so a physical send and a phone send cannot share a slot.

ALTER TABLE gps_mobile_ats_submissions
  DROP CONSTRAINT gps_mobile_ats_submissions_ministry_env_check;

ALTER TABLE gps_mobile_ats_submissions
  ADD CONSTRAINT gps_mobile_ats_submissions_ministry_env_check
  CHECK (ministry_env IN ('test', 'live'));

ALTER TABLE gps_mobile_ats_submissions
  DROP CONSTRAINT gps_mobile_ats_submissions_status_check;

ALTER TABLE gps_mobile_ats_submissions
  ADD CONSTRAINT gps_mobile_ats_submissions_status_check
  CHECK (status IN ('pending', 'succeeded', 'failed', 'blocked'));

ALTER TABLE gps_mobile_ats_submissions
  ADD COLUMN vehicle_id UUID REFERENCES partner_vehicles (id),
  ADD COLUMN period_slot BIGINT,
  ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN next_attempt_at TIMESTAMPTZ,
  ADD COLUMN last_error TEXT;

CREATE UNIQUE INDEX gps_mobile_ats_submissions_vehicle_slot_uidx
  ON gps_mobile_ats_submissions (vehicle_id, period_slot)
  WHERE period_slot IS NOT NULL;

COMMENT ON COLUMN gps_mobile_ats_submissions.gnss_time IS
  'gps_mobile_positions.recorded_at copied at queue time. Not rewritten to the send time.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT UPDATE ON TABLE gps_mobile_ats_submissions TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT UPDATE ON TABLE gps_mobile_ats_submissions TO tripetica_app;
  END IF;
END
$$;
