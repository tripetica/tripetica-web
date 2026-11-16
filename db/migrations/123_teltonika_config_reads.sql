-- Read-only Teltonika getparam queue. Rows cannot contain setparam.
CREATE TABLE gps_teltonika_config_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES gps_devices (id) ON DELETE CASCADE,
  command_text TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'queued',
  response_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  CONSTRAINT gps_teltonika_config_reads_command_chk
    CHECK (command_text = 'getparam 11000;11003;11004;11005;11006;11007;11008;11011;11015;11019'),
  CONSTRAINT gps_teltonika_config_reads_phase_chk
    CHECK (phase IN ('queued', 'sent', 'answered', 'timeout', 'cancelled'))
);

CREATE UNIQUE INDEX gps_teltonika_config_reads_open_uidx
  ON gps_teltonika_config_reads (device_id)
  WHERE phase IN ('queued', 'sent');

COMMENT ON TABLE gps_teltonika_config_reads IS
  'One Green Driving getparam at a time. The listener never sends setparam from this table.';

REVOKE ALL ON TABLE gps_teltonika_config_reads FROM PUBLIC;

DO $$
DECLARE app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['tripetica_app', 'tripetica_dev_app'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON gps_teltonika_config_reads TO %I', app_role);
    END IF;
  END LOOP;
END $$;
