-- ATS opt-in for an existing vehicle and one explicit GPS device.
-- Default is off because this table starts empty. Disabling a row keeps it.
-- This migration does not send positions to the ministry.

CREATE TABLE gps_ats_settings (
  vehicle_id UUID PRIMARY KEY REFERENCES partner_vehicles (id),
  source_device_id UUID REFERENCES gps_devices (id),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gps_ats_settings_enabled_source_chk
    CHECK (NOT enabled OR source_device_id IS NOT NULL)
);

CREATE TABLE gps_ats_control_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES partner_vehicles (id),
  device_id UUID REFERENCES gps_devices (id),
  action TEXT NOT NULL,
  actor_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gps_ats_control_events_action_chk
    CHECK (action IN ('enable', 'disable'))
);

CREATE INDEX gps_ats_control_events_vehicle_idx
  ON gps_ats_control_events (vehicle_id, created_at DESC);

CREATE TABLE gps_ats_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID NOT NULL UNIQUE REFERENCES gps_positions (id),
  company_id UUID NOT NULL REFERENCES uetds_companies (id),
  vehicle_id UUID NOT NULL REFERENCES partner_vehicles (id),
  device_id UUID NOT NULL REFERENCES gps_devices (id),
  gnss_time TIMESTAMPTZ NOT NULL,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  ministry_env TEXT NOT NULL,
  sonuc_kodu INTEGER,
  sonuc_mesaji TEXT,
  status TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  CONSTRAINT gps_ats_submissions_env_chk
    CHECK (ministry_env IN ('test', 'live')),
  CONSTRAINT gps_ats_submissions_status_chk
    CHECK (status IN ('pending', 'succeeded', 'failed', 'blocked')),
  CONSTRAINT gps_ats_submissions_attempts_chk
    CHECK (attempt_count >= 0)
);

CREATE INDEX gps_ats_submissions_device_idx
  ON gps_ats_submissions (device_id, queued_at DESC);

CREATE INDEX gps_ats_submissions_retry_idx
  ON gps_ats_submissions (next_attempt_at)
  WHERE status = 'failed';

COMMENT ON TABLE gps_ats_settings IS
  'Per-vehicle ATS switch and the single GPS device allowed to supply positions. Empty means off.';
COMMENT ON TABLE gps_ats_submissions IS
  'ATS konum attempts. Separate from uetds_notifications. position_id is unique.';
COMMENT ON COLUMN gps_ats_submissions.gnss_time IS
  'gps_positions.recorded_at copied at queue time. Not the server receive time.';

REVOKE ALL ON TABLE gps_ats_settings FROM PUBLIC;
REVOKE ALL ON TABLE gps_ats_control_events FROM PUBLIC;
REVOKE ALL ON TABLE gps_ats_submissions FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE gps_ats_settings TO tripetica_dev_app;
    GRANT SELECT, INSERT ON TABLE gps_ats_control_events TO tripetica_dev_app;
    GRANT SELECT, INSERT, UPDATE ON TABLE gps_ats_submissions TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE gps_ats_settings TO tripetica_app;
    GRANT SELECT, INSERT ON TABLE gps_ats_control_events TO tripetica_app;
    GRANT SELECT, INSERT, UPDATE ON TABLE gps_ats_submissions TO tripetica_app;
  END IF;
END
$$;
