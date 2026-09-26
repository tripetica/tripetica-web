-- Local deletion is gated by server authorization and a fresh Ministry cancellation query.
-- Child uetds_notification_revisions already use ON DELETE CASCADE (058).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT DELETE ON TABLE uetds_notifications TO tripetica_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT DELETE ON TABLE uetds_notifications TO tripetica_dev_app;
  END IF;
END
$$;
