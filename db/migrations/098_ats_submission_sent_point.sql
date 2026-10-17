-- Record the coordinates and district codes already chosen for a ministry
-- ATS call. Nullable so older rows stay unchanged. This does not send,
-- retry, or alter a ministry result.

ALTER TABLE gps_ats_submissions
  ADD COLUMN sent_latitude TEXT,
  ADD COLUMN sent_longitude TEXT,
  ADD COLUMN sent_il_kodu INTEGER,
  ADD COLUMN sent_ilce_mernis_kodu INTEGER;

ALTER TABLE gps_mobile_ats_submissions
  ADD COLUMN sent_latitude TEXT,
  ADD COLUMN sent_longitude TEXT,
  ADD COLUMN sent_il_kodu INTEGER,
  ADD COLUMN sent_ilce_mernis_kodu INTEGER;

ALTER TABLE gps_ats_submissions
  ADD CONSTRAINT gps_ats_submissions_sent_point_chk
  CHECK (
    (sent_latitude IS NULL AND sent_longitude IS NULL AND sent_il_kodu IS NULL AND sent_ilce_mernis_kodu IS NULL)
    OR (
      sent_latitude ~ '^-?[0-9]+(\.[0-9]+)?$'
      AND sent_longitude ~ '^-?[0-9]+(\.[0-9]+)?$'
      AND sent_il_kodu BETWEEN 1 AND 81
      AND sent_ilce_mernis_kodu >= 1
    )
  );

ALTER TABLE gps_mobile_ats_submissions
  ADD CONSTRAINT gps_mobile_ats_submissions_sent_point_chk
  CHECK (
    (sent_latitude IS NULL AND sent_longitude IS NULL AND sent_il_kodu IS NULL AND sent_ilce_mernis_kodu IS NULL)
    OR (
      sent_latitude ~ '^-?[0-9]+(\.[0-9]+)?$'
      AND sent_longitude ~ '^-?[0-9]+(\.[0-9]+)?$'
      AND sent_il_kodu BETWEEN 1 AND 81
      AND sent_ilce_mernis_kodu >= 1
    )
  );

COMMENT ON COLUMN gps_ats_submissions.sent_latitude IS
  'Latitude string passed to the ministry on the latest ATS call. Null when that attempt did not call the ministry.';
COMMENT ON COLUMN gps_ats_submissions.sent_il_kodu IS
  'Province code passed to the ministry on the latest ATS call.';
COMMENT ON COLUMN gps_ats_submissions.sent_ilce_mernis_kodu IS
  'District MERNIS code passed to the ministry on the latest ATS call.';
