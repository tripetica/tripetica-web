-- App roles can read and record immobilizer state. Command rows are append-only.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE gps_immobilizer_status TO tripetica_dev_app;
    GRANT SELECT, INSERT ON TABLE gps_immobilizer_commands TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE gps_immobilizer_status TO tripetica_app;
    GRANT SELECT, INSERT ON TABLE gps_immobilizer_commands TO tripetica_app;
  END IF;
END
$$;
