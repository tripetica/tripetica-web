-- 081 left command rows append-only. The listener must update a queued
-- command to sent, then to acknowledged or timeout. Without UPDATE the
-- claim fails, the command stays queued, and nothing is written to the device.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT UPDATE ON TABLE gps_immobilizer_commands TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT UPDATE ON TABLE gps_immobilizer_commands TO tripetica_app;
  END IF;
END
$$;
