-- GPS/ATS fault records, ministry attempts, and ops alert deliveries.
-- Position ingest, ATS konum cadence, U-ETDS sefer calls, and the immobilizer are unchanged.
-- V15 atsArizaBildir has no separate "fault cleared" method and no reference field.

CREATE TABLE gps_ats_faults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES partner_vehicles (id),
  plate TEXT NOT NULL,
  plate_key TEXT NOT NULL,
  device_id UUID REFERENCES gps_devices (id),
  imei TEXT,
  partner_id UUID REFERENCES partners (id),
  company_id UUID REFERENCES uetds_companies (id),
  driver_id UUID REFERENCES partner_drivers (id),
  driver_name TEXT,
  driver_phone TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  kind TEXT NOT NULL,
  description TEXT NOT NULL,
  ministry_status TEXT NOT NULL DEFAULT 'local',
  ministry_accepted_at TIMESTAMPTZ,
  ministry_reference TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by_ops_user_id UUID REFERENCES ops_users (id),
  created_by_ops_user_id UUID NOT NULL REFERENCES ops_users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gps_ats_faults_kind_chk
    CHECK (kind IN ('gnss', 'connection', 'ats', 'power', 'other')),
  CONSTRAINT gps_ats_faults_status_chk
    CHECK (ministry_status IN ('local', 'accepted', 'rejected', 'unknown', 'limit_blocked', 'withheld')),
  CONSTRAINT gps_ats_faults_description_chk
    CHECK (char_length(description) BETWEEN 1 AND 500),
  CONSTRAINT gps_ats_faults_plate_chk
    CHECK (char_length(plate_key) BETWEEN 2 AND 20)
);

CREATE INDEX gps_ats_faults_vehicle_idx
  ON gps_ats_faults (vehicle_id, ministry_accepted_at);

CREATE INDEX gps_ats_faults_plate_idx
  ON gps_ats_faults (plate_key, ministry_accepted_at);

CREATE INDEX gps_ats_faults_open_idx
  ON gps_ats_faults (started_at)
  WHERE resolved_at IS NULL;

COMMENT ON TABLE gps_ats_faults IS
  'Operator GPS/ATS fault records. The 30-day ministry limit follows the vehicle and plate, not the IMEI.';

CREATE TABLE gps_ats_fault_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fault_id UUID NOT NULL REFERENCES gps_ats_faults (id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  outcome TEXT NOT NULL,
  sonuc_kodu INTEGER,
  sonuc_mesaji TEXT,
  reference_text TEXT,
  raw_safe TEXT,
  actor_ops_user_id UUID REFERENCES ops_users (id),
  CONSTRAINT gps_ats_fault_attempts_outcome_chk
    CHECK (outcome IN ('sending', 'accepted', 'rejected', 'unknown', 'limit_blocked', 'withheld'))
);

CREATE UNIQUE INDEX gps_ats_fault_attempt_sending_uidx
  ON gps_ats_fault_attempts (fault_id)
  WHERE outcome = 'sending';

CREATE INDEX gps_ats_fault_attempts_fault_idx
  ON gps_ats_fault_attempts (fault_id, attempted_at);

COMMENT ON TABLE gps_ats_fault_attempts IS
  'Append-only ministry atsArizaBildir attempts. Earlier responses are not replaced.';

CREATE TABLE gps_ats_outages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES partner_vehicles (id),
  plate TEXT NOT NULL,
  device_id UUID REFERENCES gps_devices (id),
  trip_notification_id UUID,
  trip_started_at TIMESTAMPTZ NOT NULL,
  kind TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  last_gnss_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  last_ats_success_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  close_reason TEXT,
  source_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gps_ats_outages_kind_chk CHECK (kind IN ('gnss', 'ats')),
  CONSTRAINT gps_ats_outages_close_chk
    CHECK (close_reason IS NULL OR close_reason IN ('gnss_restored', 'fault_reported', 'trip_ended', 'ats_recovered'))
);

CREATE UNIQUE INDEX gps_ats_outages_open_uidx
  ON gps_ats_outages (kind, source_key)
  WHERE closed_at IS NULL;

CREATE TABLE gps_ats_alert_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL,
  kind TEXT NOT NULL,
  source_key TEXT NOT NULL,
  slot TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT,
  plate TEXT,
  title TEXT,
  body TEXT,
  href TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gps_ats_alert_deliveries_channel_chk
    CHECK (channel IN ('panel', 'push', 'email')),
  CONSTRAINT gps_ats_alert_deliveries_kind_chk
    CHECK (kind IN ('gnss_outage', 'ats_error', 'repair_reminder', 'repair_overdue')),
  CONSTRAINT gps_ats_alert_deliveries_status_chk
    CHECK (status IN ('sent', 'failed', 'skipped'))
);

CREATE UNIQUE INDEX gps_ats_alert_delivery_uidx
  ON gps_ats_alert_deliveries (channel, kind, source_key, slot);

CREATE INDEX gps_ats_alert_deliveries_recent_idx
  ON gps_ats_alert_deliveries (created_at DESC);

COMMENT ON TABLE gps_ats_alert_deliveries IS
  'Ops panel, browser push, and email deliveries. The unique key stops a timer restart from repeating the same slot.';

REVOKE ALL ON TABLE gps_ats_faults FROM PUBLIC;
REVOKE ALL ON TABLE gps_ats_fault_attempts FROM PUBLIC;
REVOKE ALL ON TABLE gps_ats_outages FROM PUBLIC;
REVOKE ALL ON TABLE gps_ats_alert_deliveries FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE gps_ats_faults TO tripetica_dev_app;
    GRANT SELECT, INSERT, UPDATE ON TABLE gps_ats_fault_attempts TO tripetica_dev_app;
    GRANT SELECT, INSERT, UPDATE ON TABLE gps_ats_outages TO tripetica_dev_app;
    GRANT SELECT, INSERT ON TABLE gps_ats_alert_deliveries TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE gps_ats_faults TO tripetica_app;
    GRANT SELECT, INSERT, UPDATE ON TABLE gps_ats_fault_attempts TO tripetica_app;
    GRANT SELECT, INSERT, UPDATE ON TABLE gps_ats_outages TO tripetica_app;
    GRANT SELECT, INSERT ON TABLE gps_ats_alert_deliveries TO tripetica_app;
  END IF;
END
$$;
