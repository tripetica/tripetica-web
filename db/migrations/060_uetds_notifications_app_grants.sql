-- Production app-role grants for uetds_notifications.
-- 055 created the table without GRANT. Other U-ETDS tables already grant
-- tripetica_app. Additive and idempotent. No data rewrite.

REVOKE ALL ON TABLE uetds_notifications FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE uetds_notifications TO tripetica_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE uetds_notifications TO tripetica_dev_app;
  END IF;
END
$$;
