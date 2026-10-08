-- A GPS position may be reported again in a later two-minute period.
-- The vehicle/period slot remains unique, so one SOAP call is kept per window.
-- This migration does not invent missing history and does not send positions.

ALTER TABLE gps_ats_submissions
  DROP CONSTRAINT IF EXISTS gps_ats_submissions_position_id_key;

COMMENT ON COLUMN gps_ats_submissions.position_id IS
  'Source GPS row. The same row may back more than one ministry attempt in different period slots.';
