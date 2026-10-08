export const ATS_RETRY_SELECT_SQL = `
SELECT submission.id
FROM gps_ats_submissions submission
JOIN gps_ats_settings settings ON settings.vehicle_id = submission.vehicle_id
WHERE settings.enabled = TRUE
  AND submission.status = 'failed'
  AND submission.ministry_env = 'test'
  AND submission.attempt_count < 3
  AND submission.next_attempt_at IS NOT NULL
  AND submission.next_attempt_at <= $1
`;
