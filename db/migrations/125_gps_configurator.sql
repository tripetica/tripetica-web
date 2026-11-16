-- Versioned Teltonika configuration. This migration stores profiles and jobs.
-- It does not insert codec 12 commands and it does not accept a firmware payload.

CREATE TABLE gps_config_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind = 'standard'),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX gps_config_profiles_standard_uidx ON gps_config_profiles (kind);

CREATE TABLE gps_config_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES gps_config_profiles (id),
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved')),
  values JSONB NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, version)
);

CREATE TABLE gps_config_overrides (
  device_id UUID PRIMARY KEY REFERENCES gps_devices (id),
  values JSONB NOT NULL,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE gps_config_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES gps_devices (id),
  version_id UUID NOT NULL REFERENCES gps_config_versions (id),
  phase TEXT NOT NULL CHECK (phase IN (
    'waiting', 'waiting_link', 'reading', 'applying', 'replied', 'verifying', 'verified', 'failed', 'unsupported'
  )),
  error TEXT,
  planned JSONB NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX gps_config_jobs_device_idx ON gps_config_jobs (device_id, created_at DESC);

CREATE TABLE gps_config_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE gps_firmware_catalog (
  model TEXT NOT NULL,
  firmware TEXT NOT NULL,
  remote_config BOOLEAN NOT NULL DEFAULT TRUE,
  payload_ready BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (model, firmware),
  CHECK (payload_ready = FALSE)
);

COMMENT ON TABLE gps_firmware_catalog IS
  'Firmware compatibility records only. payload_ready must stay false until a reviewed firmware feature exists.';

INSERT INTO gps_config_profiles (kind, name)
VALUES ('standard', 'Tripetica Standart');

INSERT INTO gps_config_versions (profile_id, version, status, values, note)
SELECT id, 1, 'approved',
  '{"11000":"1","11003":"0","11004":"2.31","11005":"2.52","11006":"2.94","11007":"1","11008":"1","11011":"0","11015":"0","11019":"0"}'::jsonb,
  '15.11.2026 verified read-back. Advanced eco driving is off. Output 11003 stays critical.'
FROM gps_config_profiles
WHERE kind = 'standard';

INSERT INTO gps_firmware_catalog (model, firmware)
VALUES ('fmb920', '03.27.14');

REVOKE ALL ON gps_config_profiles, gps_config_versions, gps_config_overrides, gps_config_jobs, gps_config_audits, gps_firmware_catalog FROM PUBLIC;

DO $$
DECLARE app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['tripetica_app', 'tripetica_dev_app'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON gps_config_profiles, gps_config_versions, gps_config_overrides, gps_config_jobs, gps_config_audits, gps_firmware_catalog TO %I', app_role);
    END IF;
  END LOOP;
END $$;
