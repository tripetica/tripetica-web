-- Keep the sefer identity of a ministry ATS send after the notification row is removed.
-- The live link may cascade away. This context row does not.

CREATE TABLE gps_ats_submission_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES gps_ats_submissions (id) ON DELETE CASCADE,
  notification_id UUID,
  ministry_reference TEXT,
  company_short_name TEXT,
  plate TEXT,
  trip_start TEXT,
  trip_end TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gps_ats_submission_context_pair_uidx UNIQUE (submission_id, notification_id)
);

COMMENT ON TABLE gps_ats_submission_context IS
  'Sefer, firma, plaka and ministry reference copied for an ATS send. Survives notification deletion.';

REVOKE ALL ON TABLE gps_ats_submission_context FROM PUBLIC;

ALTER TABLE gps_mobile_ats_submissions
  ADD COLUMN ministry_reference TEXT,
  ADD COLUMN company_short_name TEXT,
  ADD COLUMN plate TEXT,
  ADD COLUMN trip_start TEXT,
  ADD COLUMN trip_end TEXT;

UPDATE gps_mobile_ats_submissions submission
   SET ministry_reference = notification.ministry_reference,
       company_short_name = notification.company_short_name,
       plate = NULLIF(notification.snapshot->'vehicle'->>'plate', ''),
       trip_start = NULLIF(btrim(concat_ws(' ', notification.snapshot->'trip'->>'startDate', notification.snapshot->'trip'->>'startTime')), ''),
       trip_end = NULLIF(btrim(concat_ws(' ', notification.snapshot->'trip'->>'endDate', notification.snapshot->'trip'->>'endTime')), '')
  FROM uetds_notifications notification
 WHERE notification.id = submission.notification_id
   AND submission.ministry_reference IS NULL;

ALTER TABLE gps_mobile_ats_submissions
  ALTER COLUMN notification_id DROP NOT NULL;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
   WHERE rel.relname = 'gps_mobile_ats_submissions'
     AND con.contype = 'f'
     AND pg_get_constraintdef(con.oid) ILIKE '%uetds_notifications%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE gps_mobile_ats_submissions DROP CONSTRAINT %I', constraint_name);
  END IF;
END
$$;

ALTER TABLE gps_mobile_ats_submissions
  ADD CONSTRAINT gps_mobile_ats_submissions_notification_id_fkey
  FOREIGN KEY (notification_id) REFERENCES uetds_notifications (id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION gps_ats_preserve_submission_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO gps_ats_submission_context (
    submission_id, notification_id, ministry_reference, company_short_name, plate, trip_start, trip_end
  )
  SELECT link.submission_id,
         OLD.id,
         OLD.ministry_reference,
         OLD.company_short_name,
         NULLIF(OLD.snapshot->'vehicle'->>'plate', ''),
         NULLIF(btrim(concat_ws(' ', OLD.snapshot->'trip'->>'startDate', OLD.snapshot->'trip'->>'startTime')), ''),
         NULLIF(btrim(concat_ws(' ', OLD.snapshot->'trip'->>'endDate', OLD.snapshot->'trip'->>'endTime')), '')
    FROM gps_ats_submission_notifications link
   WHERE link.notification_id = OLD.id
  ON CONFLICT (submission_id, notification_id) DO NOTHING;

  UPDATE gps_mobile_ats_submissions
     SET ministry_reference = COALESCE(ministry_reference, OLD.ministry_reference),
         company_short_name = COALESCE(company_short_name, OLD.company_short_name),
         plate = COALESCE(plate, NULLIF(OLD.snapshot->'vehicle'->>'plate', '')),
         trip_start = COALESCE(trip_start, NULLIF(btrim(concat_ws(' ', OLD.snapshot->'trip'->>'startDate', OLD.snapshot->'trip'->>'startTime')), '')),
         trip_end = COALESCE(trip_end, NULLIF(btrim(concat_ws(' ', OLD.snapshot->'trip'->>'endDate', OLD.snapshot->'trip'->>'endTime')), ''))
   WHERE notification_id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS gps_ats_preserve_submission_context_trg ON uetds_notifications;

CREATE TRIGGER gps_ats_preserve_submission_context_trg
  BEFORE DELETE ON uetds_notifications
  FOR EACH ROW
  EXECUTE FUNCTION gps_ats_preserve_submission_context();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT ON TABLE gps_ats_submission_context TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT ON TABLE gps_ats_submission_context TO tripetica_app;
  END IF;
END
$$;
