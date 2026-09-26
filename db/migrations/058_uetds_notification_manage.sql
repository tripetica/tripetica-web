-- DEV-only notification management: cancel/update statuses and revision audit.
ALTER TABLE uetds_notifications
  DROP CONSTRAINT IF EXISTS uetds_notifications_status_check;

ALTER TABLE uetds_notifications
  ADD CONSTRAINT uetds_notifications_status_check
    CHECK (status IN (
      'recorded',
      'submitted',
      'partial',
      'failed',
      'cancelled',
      'updating',
      'updated',
      'partial_update',
      'update_error'
    ));

CREATE TABLE IF NOT EXISTS uetds_notification_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES uetds_notifications (id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('partner', 'ops')),
  actor_user_id UUID NOT NULL,
  previous_snapshot JSONB NOT NULL,
  resulting_snapshot JSONB NOT NULL,
  changed_fields TEXT[] NOT NULL DEFAULT '{}',
  ministry_operations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS uetds_notification_revisions_notification_idx
  ON uetds_notification_revisions (notification_id, created_at DESC);

COMMENT ON TABLE uetds_notification_revisions IS
  'Audit trail for U-ETDS edits/cancels. Credentials are never stored.';

REVOKE ALL ON TABLE uetds_notification_revisions FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT ON TABLE uetds_notification_revisions TO tripetica_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT ON TABLE uetds_notification_revisions TO tripetica_dev_app;
  END IF;
END $$;
