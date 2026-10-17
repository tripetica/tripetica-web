-- One mobile ATS ministry call can belong to every sefer that was open
-- when it was sent. The submission row is not copied and its result is not changed.
-- This migration does not call the ministry.

CREATE TABLE gps_mobile_ats_submission_notifications (
  submission_id UUID NOT NULL REFERENCES gps_mobile_ats_submissions (id) ON DELETE CASCADE,
  notification_id UUID NOT NULL REFERENCES uetds_notifications (id) ON DELETE CASCADE,
  PRIMARY KEY (submission_id, notification_id)
);

CREATE INDEX gps_mobile_ats_submission_notifications_notification_idx
  ON gps_mobile_ats_submission_notifications (notification_id);

COMMENT ON TABLE gps_mobile_ats_submission_notifications IS
  'One mobile ATS SOAP attempt linked to every sefer open at queued_at. The submission row stays unique per vehicle and period.';

REVOKE ALL ON TABLE gps_mobile_ats_submission_notifications FROM PUBLIC;

INSERT INTO gps_mobile_ats_submission_notifications (submission_id, notification_id)
SELECT id, notification_id
  FROM gps_mobile_ats_submissions
 WHERE notification_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO gps_mobile_ats_submission_notifications (submission_id, notification_id)
SELECT submission.id, notification.id
  FROM gps_mobile_ats_submissions submission
  JOIN gps_mobile_positions position ON position.id = submission.mobile_position_id
  JOIN partner_vehicles vehicle ON vehicle.id = submission.vehicle_id
  JOIN uetds_notifications notification
    ON notification.vehicle_id = submission.vehicle_id
   AND notification.driver_id = position.driver_id
   AND notification.company_id = vehicle.uetds_company_id
   AND notification.ministry_env = submission.ministry_env
   AND notification.ministry_reference IS NOT NULL
   AND notification.status = ANY (ARRAY[
     'submitted', 'updated', 'partial', 'partial_update', 'update_error', 'updating'
   ])
   AND notification.snapshot->'trip'->>'startDate' ~ '^\d{4}-\d{2}-\d{2}$'
   AND notification.snapshot->'trip'->>'startTime' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
   AND notification.snapshot->'trip'->>'endDate' ~ '^\d{4}-\d{2}-\d{2}$'
   AND notification.snapshot->'trip'->>'endTime' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
   AND submission.queued_at >= (
     (notification.snapshot->'trip'->>'startDate') || ' ' || (notification.snapshot->'trip'->>'startTime')
   )::timestamp AT TIME ZONE 'Europe/Istanbul'
   AND submission.queued_at < (
     (notification.snapshot->'trip'->>'endDate') || ' ' || (notification.snapshot->'trip'->>'endTime')
   )::timestamp AT TIME ZONE 'Europe/Istanbul'
   AND (
     NULLIF(replace(upper(COALESCE(notification.snapshot->'vehicle'->>'plate', '')), ' ', ''), '') IS NULL
     OR replace(upper(notification.snapshot->'vehicle'->>'plate'), ' ', '') = submission.plate
   )
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT ON TABLE gps_mobile_ats_submission_notifications TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT ON TABLE gps_mobile_ats_submission_notifications TO tripetica_app;
  END IF;
END
$$;
