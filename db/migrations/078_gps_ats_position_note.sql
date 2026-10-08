-- Audit mark for a ministry attempt that reused a stored GPS fix.
-- Null means the fix was current when the attempt was queued.
-- This does not change the coordinate or the GNSS time sent to the ministry.

ALTER TABLE gps_ats_submissions
  ADD COLUMN position_note TEXT;

ALTER TABLE gps_ats_submissions
  ADD CONSTRAINT gps_ats_submissions_position_note_chk
  CHECK (position_note IS NULL OR position_note IN ('offline', 'gnss_fix', 'stale_position'));

COMMENT ON COLUMN gps_ats_submissions.position_note IS
  'Why the queued coordinate was not a current measurement. Null means it was current. Not a ministry result.';
