-- Allow one exact Green Driving setparam. The apply flag stays off until the first device is verified.
ALTER TABLE gps_teltonika_config_reads
  DROP CONSTRAINT gps_teltonika_config_reads_command_chk;

ALTER TABLE gps_teltonika_config_reads
  ADD CONSTRAINT gps_teltonika_config_reads_command_chk
  CHECK (command_text IN (
    'getparam 11000;11003;11004;11005;11006;11007;11008;11011;11015;11019',
    'setparam 11000:1;11019:0;11011:0;11015:0'
  ));

CREATE TABLE gps_teltonika_config_apply (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gps_teltonika_config_apply_one_chk CHECK (id)
);

INSERT INTO gps_teltonika_config_apply (id, enabled) VALUES (TRUE, FALSE);

COMMENT ON TABLE gps_teltonika_config_apply IS
  'When enabled, a completed Green Driving read may queue the one approved setparam, then a verify read.';

REVOKE ALL ON TABLE gps_teltonika_config_apply FROM PUBLIC;

DO $$
DECLARE app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['tripetica_app', 'tripetica_dev_app'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('GRANT SELECT ON gps_teltonika_config_apply TO %I', app_role);
    END IF;
  END LOOP;
END $$;
