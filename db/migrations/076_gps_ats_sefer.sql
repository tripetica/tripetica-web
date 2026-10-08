-- Link one ATS konum attempt to every U-ETDS sefer it covers.
-- period_slot keeps two workers from sending the same vehicle twice in one two-minute window.
-- This migration does not delete history and does not send positions.

ALTER TABLE gps_ats_submissions
  ADD COLUMN period_slot BIGINT;

CREATE UNIQUE INDEX gps_ats_submissions_vehicle_slot_uidx
  ON gps_ats_submissions (vehicle_id, period_slot)
  WHERE period_slot IS NOT NULL;

CREATE TABLE gps_ats_submission_notifications (
  submission_id UUID NOT NULL REFERENCES gps_ats_submissions (id) ON DELETE CASCADE,
  notification_id UUID NOT NULL REFERENCES uetds_notifications (id) ON DELETE CASCADE,
  PRIMARY KEY (submission_id, notification_id)
);

CREATE INDEX gps_ats_submission_notifications_notification_idx
  ON gps_ats_submission_notifications (notification_id);

COMMENT ON COLUMN gps_ats_submissions.period_slot IS
  'floor(epoch_ms / 120000). One ministry konum attempt per vehicle per slot.';
COMMENT ON TABLE gps_ats_submission_notifications IS
  'One SOAP attempt may belong to every overlapping accepted sefer. The submission row is not copied.';

REVOKE ALL ON TABLE gps_ats_submission_notifications FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE gps_ats_submissions TO tripetica_dev_app;
    GRANT SELECT, INSERT ON TABLE gps_ats_submission_notifications TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE gps_ats_submissions TO tripetica_app;
    GRANT SELECT, INSERT ON TABLE gps_ats_submission_notifications TO tripetica_app;
  END IF;
END
$$;
